import { NextResponse, type NextRequest } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { handle, HttpError, requireUser } from "@/lib/auth";
import { loadProjectFor, toProjectJSON } from "@/lib/projects";
import { projectSchema } from "@/lib/validators";
import { recalculateUsedQty, type IMaterial } from "@/models/Project";

type Ctx = RouteContext<"/api/projects/[id]">;

export const GET = handle(async (_req: NextRequest, ctx: Ctx) => {
  const user = await requireUser();
  await connectDB();
  const project = await loadProjectFor(user, (await ctx.params).id);
  return NextResponse.json({ project: toProjectJSON(project, user) });
});

export const PUT = handle(async (req: NextRequest, ctx: Ctx) => {
  const user = await requireUser();
  const data = projectSchema.parse(await req.json());
  await connectDB();
  const project = await loadProjectFor(user, (await ctx.params).id);

  const existing = new Map(project.materials.map((m) => [m._id.toString(), m]));
  const keptIds = new Set(data.materials.filter((m) => m._id && existing.has(m._id)).map((m) => m._id!));

  // Don't silently orphan consumption history: removing a material that has usage must be explicit.
  const usedIds = new Set(project.usage.map((u) => u.materialId.toString()));
  const blocked = project.materials.filter((m) => !keptIds.has(m._id.toString()) && usedIds.has(m._id.toString()));
  if (blocked.length) {
    throw new HttpError(
      400,
      `Cannot remove ${blocked.map((m) => m.itemCode).join(", ")}: usage has been recorded. Delete its usage entries first.`,
    );
  }

  const materials: IMaterial[] = data.materials.map(({ _id, ...m }) => {
    const prev = _id ? existing.get(_id) : undefined;
    return { ...m, _id: prev?._id ?? new Types.ObjectId(), usedQty: prev?.usedQty ?? 0 };
  });

  project.set({
    name: data.name,
    moNumber: data.moNumber,
    cwoNumber: data.cwoNumber,
    siteName: data.siteName,
    location: data.location,
    vendor: data.vendor,
    budget: data.budget,
    status: data.status,
    materials,
  });
  recalculateUsedQty(project);
  await project.save();

  return NextResponse.json({ project: toProjectJSON(project, user) });
});

export const DELETE = handle(async (_req: NextRequest, ctx: Ctx) => {
  const user = await requireUser();
  await connectDB();
  const project = await loadProjectFor(user, (await ctx.params).id);
  await project.deleteOne();
  return NextResponse.json({ ok: true });
});
