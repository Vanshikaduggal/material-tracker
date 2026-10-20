import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { handle, requireUser } from "@/lib/auth";
import { projectSchema } from "@/lib/validators";
import { materialStats } from "@/lib/calc";
import { Project } from "@/models/Project";

export const GET = handle(async () => {
  const user = await requireUser();
  await connectDB();

  const filter = user.role === "admin" ? {} : { createdBy: user.id };
  const projects = await Project.find(filter).select("-usage").sort({ updatedAt: -1 }).lean();

  const summaries = projects.map(({ materials, ...p }) => {
    let plannedCost = 0;
    let consumedCost = 0;
    for (const m of materials) {
      const s = materialStats(m);
      plannedCost += s.plannedCost;
      consumedCost += s.consumedCost;
    }
    return {
      ...p,
      materialCount: materials.length,
      plannedCost: Math.round(plannedCost * 100) / 100,
      consumedCost: Math.round(consumedCost * 100) / 100,
      canEdit: user.role === "admin" || p.createdBy.toString() === user.id,
    };
  });

  return NextResponse.json({ projects: summaries });
});

export const POST = handle(async (req: Request) => {
  const user = await requireUser();
  const data = projectSchema.parse(await req.json());
  await connectDB();

  const project = await Project.create({
    ...data,
    materials: data.materials.map((m) => ({ ...m, _id: undefined, usedQty: 0 })),
    usage: [],
    createdBy: user.id,
    createdByName: user.name,
  });

  return NextResponse.json({ project: { _id: project._id.toString() } }, { status: 201 });
});
