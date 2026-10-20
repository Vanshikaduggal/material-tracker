export type Role = "admin" | "user";
export type ProjectStatus = "In Progress" | "On Hold" | "Completed";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface Material {
  _id: string;
  itemCode: string;
  itemDescription: string;
  category: string;
  uom: string;
  plannedQty: number;
  unitRate: number;
  usedQty: number;
}

export interface UsageEntry {
  _id: string;
  materialId: string;
  quantity: number;
  date: string;
  remarks: string;
  recordedBy: string;
  recordedByName: string;
  createdAt?: string;
}

export interface Project {
  _id: string;
  name: string;
  moNumber: string;
  cwoNumber: string;
  siteName: string;
  location: string;
  vendor: string;
  budget: number;
  status: ProjectStatus;
  materials: Material[];
  usage: UsageEntry[];
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
  canEdit?: boolean;
}

export interface ProjectSummary extends Omit<Project, "materials" | "usage"> {
  materialCount: number;
  plannedCost: number;
  consumedCost: number;
}

export interface UserRow {
  _id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  createdAt: string;
  projectCount: number;
}
