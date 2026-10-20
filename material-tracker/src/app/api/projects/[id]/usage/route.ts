import { NextResponse, type NextRequest } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { handle, HttpError, requireUser } from "@/lib/auth";
import { loadProjectFor, toProjectJSON } from "@/lib/projects";
import { usageSchema } from "@/lib/validators";
import { recalculateUsedQty } from "@/models/Project";

export const POST = handle(async (req: NextRequest, ctx: RouteContext<"/api/projects/[id]/usage">) => {
  const user = await requireUser();
  const data = usageSchema.parse(await req.json());
  await connectDB();
  const project = await loadProjectFor(user, (await ctx.params).id);

  if (!project.materials.some((m) => m._id.toString() === data.materialId)) {
    throw new HttpError(400, "Selected material does not belong to this project");
  }

  project.usage.push({
    _id: new Types.ObjectId(),
    materialId: new Types.ObjectId(data.materialId),
    quantity: data.quantity,
    date: data.date,
    remarks: data.remarks,
    recordedBy: new Types.ObjectId(user.id),
    recordedByName: user.name,
  });
  recalculateUsedQty(project);
  await project.save();

  return NextResponse.json({ project: toProjectJSON(project, user) }, { status: 201 });
});
