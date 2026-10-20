import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { connectDB } from "@/lib/db";
import { handle, HttpError, requireAdmin } from "@/lib/auth";
import { createUserSchema } from "@/lib/validators";
import { User } from "@/models/User";
import { Project } from "@/models/Project";

export const GET = handle(async () => {
  await requireAdmin();
  await connectDB();

  const [users, counts] = await Promise.all([
    User.find().sort({ createdAt: -1 }).lean(),
    Project.aggregate<{ _id: unknown; count: number }>([{ $group: { _id: "$createdBy", count: { $sum: 1 } } }]),
  ]);
  const countMap = new Map(counts.map((c) => [String(c._id), c.count]));

  return NextResponse.json({
    users: users.map((u) => ({
      _id: u._id.toString(),
      name: u.name,
      email: u.email,
      role: u.role,
      active: u.active,
      createdAt: u.createdAt,
      projectCount: countMap.get(u._id.toString()) ?? 0,
    })),
  });
});

export const POST = handle(async (req: Request) => {
  await requireAdmin();
  const { name, email, password, role } = createUserSchema.parse(await req.json());
  await connectDB();

  if (await User.exists({ email })) throw new HttpError(409, "An account with this email already exists");
  const user = await User.create({ name, email, role, passwordHash: await hash(password, 12) });

  return NextResponse.json({ user: { _id: user._id.toString() } }, { status: 201 });
});
