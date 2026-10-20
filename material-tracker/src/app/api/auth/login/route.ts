import { NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { connectDB } from "@/lib/db";
import { handle, HttpError } from "@/lib/auth";
import { loginSchema } from "@/lib/validators";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@/lib/session";
import { User } from "@/models/User";

export const POST = handle(async (req: Request) => {
  const { email, password, portal } = loginSchema.parse(await req.json());
  await connectDB();

  const user = await User.findOne({ email }).select("+passwordHash");
  if (!user || !(await compare(password, user.passwordHash))) {
    throw new HttpError(401, "Invalid email or password");
  }
  if (!user.active) throw new HttpError(403, "Your account has been deactivated. Contact the administrator.");
  if (portal === "admin" && user.role !== "admin") {
    throw new HttpError(403, "This account does not have admin access. Use the user login instead.");
  }
  if (portal === "user" && user.role === "admin") {
    throw new HttpError(403, "Admin accounts must sign in through the Admin login.");
  }

  const token = await signSession({ sub: user._id.toString(), name: user.name, email: user.email, role: user.role });
  const res = NextResponse.json({ user: { id: user._id.toString(), name: user.name, email: user.email, role: user.role } });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
  return res;
});
