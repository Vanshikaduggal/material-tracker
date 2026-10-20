import { NextResponse, type NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { handle, HttpError, requireUser } from "@/lib/auth";
import { loadProjectFor, toProjectJSON } from "@/lib/projects";
import { recalculateUsedQty } from "@/models/Project";

export const DELETE = handle(
  async (_req: NextRequest, ctx: RouteContext<"/api/projects/[id]/usage/[usageId]">) => {
    const user = await requireUser();
    const { id, usageId } = await ctx.params;
    await connectDB();
    const project = await loadProjectFor(user, id);

    const before = project.usage.length;
    project.usage = project.usage.filter((u) => u._id.toString() !== usageId);
    if (project.usage.length === before) throw new HttpError(404, "Usage entry not found");

    recalculateUsedQty(project);
    await project.save();
    return NextResponse.json({ project: toProjectJSON(project, user) });
  },
);
