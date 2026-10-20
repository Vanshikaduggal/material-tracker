import { cookies } from "next/headers";
import { unstable_rethrow } from "next/navigation";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { connectDB } from "@/lib/db";
import { SESSION_COOKIE, verifySession, type Role } from "@/lib/session";
import { User } from "@/models/User";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Reads the session cookie and confirms the account still exists and is active. */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = await verifySession(token);
  if (!session) return null;

  await connectDB();
  const user = await User.findById(session.sub).lean();
  if (!user || !user.active) return null;
  return { id: user._id.toString(), name: user.name, email: user.email, role: user.role };
}

export async function requireUser(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) throw new HttpError(401, "Please sign in to continue");
  return user;
}

export async function requireAdmin(): Promise<AuthUser> {
  const user = await requireUser();
  if (user.role !== "admin") throw new HttpError(403, "Admin access required");
  return user;
}

export function canEditProject(user: AuthUser, ownerId: { toString(): string }) {
  return user.role === "admin" || ownerId.toString() === user.id;
}

/** Wraps a route handler with consistent JSON error handling. */
export function handle<Args extends unknown[]>(fn: (...args: Args) => Promise<Response>) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (err) {
      unstable_rethrow(err);
      if (err instanceof HttpError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      if (err instanceof ZodError) {
        const first = err.issues[0];
        const path = first?.path.join(".");
        return NextResponse.json(
          { error: path ? `${path}: ${first.message}` : (first?.message ?? "Invalid input"), issues: err.issues },
          { status: 400 },
        );
      }
      console.error(err);
      const message = err instanceof Error && /MONGODB_URI|ECONNREFUSED|Server selection/i.test(err.message)
        ? "Database is not reachable. Check MONGODB_URI and that MongoDB is running."
        : "Something went wrong. Please try again.";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  };
}
