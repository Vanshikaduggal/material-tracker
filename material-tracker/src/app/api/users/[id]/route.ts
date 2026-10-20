import { NextResponse, type NextRequest } from "next/server";
import { hash } from "bcryptjs";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db";
import { handle, HttpError, requireAdmin } from "@/lib/auth";
import { updateUserSchema } from "@/lib/validators";
import { User } from "@/models/User";
import { Project } from "@/models/Project";

type Ctx = RouteContext<"/api/users/[id]">;

async function findUser(id: string) {
  if (!isValidObjectId(id)) throw new HttpError(404, "User not found");
  const user = await User.findById(id);
  if (!user) throw new HttpError(404, "User not found");
  return user;
}

async function ensureAnotherActiveAdmin(excludeId: string) {
  const others = await User.countDocuments({ role: "admin", active: true, _id: { $ne: excludeId } });
  if (others === 0) throw new HttpError(400, "At least one active admin account must remain");
}

export const PATCH = handle(async (req: NextRequest, ctx: Ctx) => {
  const admin = await requireAdmin();
  const { id } = await ctx.params;
  const data = updateUserSchema.parse(await req.json());
  await connectDB();
  const user = await findUser(id);

  const losingAdmin =
    user.role === "admin" && ((data.role && data.role !== "admin") || data.active === false);
  if (losingAdmin) {
    if (user._id.toString() === admin.id) throw new HttpError(400, "You cannot remove your own admin access");
    await ensureAnotherActiveAdmin(id);
  }

  if (data.role) user.role = data.role;
  if (typeof data.active === "boolean") user.active = data.active;
  if (data.password) user.passwordHash = await hash(data.password, 12);
  await user.save();

  return NextResponse.json({ ok: true });
});

export const DELETE = handle(async (_req: NextRequest, ctx: Ctx) => {
  const admin = await requireAdmin();
  const { id } = await ctx.params;
  await connectDB();
  const user = await findUser(id);

  if (user._id.toString() === admin.id) throw new HttpError(400, "You cannot delete your own account");
  if (user.role === "admin") await ensureAnotherActiveAdmin(id);
  const projectCount = await Project.countDocuments({ createdBy: user._id });
  if (projectCount > 0) {
    throw new HttpError(
      400,
      `This user owns ${projectCount} project(s). Deactivate the account instead to keep project history.`,
    );
  }

  await user.deleteOne();
  return NextResponse.json({ ok: true });
});
