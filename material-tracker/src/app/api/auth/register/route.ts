import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { connectDB } from "@/lib/db";
import { handle, HttpError } from "@/lib/auth";
import { registerSchema } from "@/lib/validators";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@/lib/session";
import { User } from "@/models/User";

export const POST = handle(async (req: Request) => {
  const { name, email, password } = registerSchema.parse(await req.json());
  await connectDB();

  if (await User.exists({ email })) throw new HttpError(409, "An account with this email already exists");

  // Self-registration always creates a regular user; only admins can grant admin rights.
  const user = await User.create({ name, email, passwordHash: await hash(password, 12), role: "user" });

  const token = await signSession({ sub: user._id.toString(), name: user.name, email: user.email, role: user.role });
  const res = NextResponse.json(
    { user: { id: user._id.toString(), name: user.name, email: user.email, role: user.role } },
    { status: 201 },
  );
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
  return res;
});
