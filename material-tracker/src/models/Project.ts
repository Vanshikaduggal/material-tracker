import { Schema, model, models, type Model, type Types } from "mongoose";

export const PROJECT_STATUSES = ["In Progress", "On Hold", "Completed"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export interface IMaterial {
  _id: Types.ObjectId;
  itemCode: string;
  itemDescription: string;
  category: string;
  uom: string;
  plannedQty: number;
  unitRate: number;
  usedQty: number;
}

export interface IUsage {
  _id: Types.ObjectId;
  materialId: Types.ObjectId;
  quantity: number;
  date: Date;
  remarks: string;
  recordedBy: Types.ObjectId;
  recordedByName: string;
  createdAt?: Date;
}

export interface IProject {
  _id: Types.ObjectId;
  name: string;
  moNumber: string;
  cwoNumber: string;
  siteName: string;
  location: string;
  vendor: string;
  budget: number;
  status: ProjectStatus;
  materials: IMaterial[];
  usage: IUsage[];
  createdBy: Types.ObjectId;
  createdByName: string;
  createdAt: Date;
  updatedAt: Date;
}

const MaterialSchema = new Schema<IMaterial>({
  itemCode: { type: String, required: true, trim: true },
  itemDescription: { type: String, required: true, trim: true },
  category: { type: String, required: true, trim: true },
  uom: { type: String, required: true, trim: true },
  plannedQty: { type: Number, required: true, min: 0, default: 0 },
  unitRate: { type: Number, required: true, min: 0, default: 0 },
  usedQty: { type: Number, required: true, min: 0, default: 0 },
});

const UsageSchema = new Schema<IUsage>(
  {
    materialId: { type: Schema.Types.ObjectId, required: true },
    quantity: { type: Number, required: true, min: 0 },
    date: { type: Date, required: true },
    remarks: { type: String, trim: true, default: "" },
    recordedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    recordedByName: { type: String, default: "" },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

const ProjectSchema = new Schema<IProject>(
  {
    name: { type: String, required: true, trim: true },
    moNumber: { type: String, required: true, trim: true, index: true },
    cwoNumber: { type: String, required: true, trim: true, index: true },
    siteName: { type: String, required: true, trim: true },
    location: { type: String, required: true, trim: true },
    vendor: { type: String, required: true, trim: true },
    budget: { type: Number, min: 0, default: 0 },
    status: { type: String, enum: PROJECT_STATUSES, default: "In Progress" },
    materials: { type: [MaterialSchema], default: [] },
    usage: { type: [UsageSchema], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    createdByName: { type: String, default: "" },
  },
  { timestamps: true },
);

export const Project: Model<IProject> =
  (models.Project as Model<IProject>) || model<IProject>("Project", ProjectSchema);

/** Keeps each material's usedQty in sync with the usage log (the usage log is the source of truth). */
export function recalculateUsedQty(project: Pick<IProject, "materials" | "usage">) {
  const totals = new Map<string, number>();
  for (const u of project.usage) {
    const key = u.materialId.toString();
    totals.set(key, (totals.get(key) ?? 0) + u.quantity);
  }
  for (const m of project.materials) {
    m.usedQty = Math.round((totals.get(m._id.toString()) ?? 0) * 1000) / 1000;
  }
}
