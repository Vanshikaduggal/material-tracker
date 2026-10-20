import { z } from "zod";
import { PROJECT_STATUSES } from "@/models/Project";

const text = (label: string, max = 200) =>
  z.string().trim().min(1, `${label} is required`).max(max, `${label} is too long`);

const nonNegative = (label: string) =>
  z.coerce.number({ error: `${label} must be a number` }).finite().min(0, `${label} cannot be negative`);

export const loginSchema = z.object({
  email: z.email("Enter a valid email").trim().toLowerCase(),
  password: z.string().min(1, "Password is required"),
  portal: z.enum(["admin", "user"]),
});

export const registerSchema = z.object({
  name: text("Name", 100),
  email: z.email("Enter a valid email").trim().toLowerCase(),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
});

export const createUserSchema = registerSchema.extend({
  role: z.enum(["admin", "user"]).default("user"),
});

export const updateUserSchema = z.object({
  role: z.enum(["admin", "user"]).optional(),
  active: z.boolean().optional(),
  password: z.string().min(8, "Password must be at least 8 characters").max(128).optional(),
});

export const materialSchema = z.object({
  _id: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  itemCode: text("Item code", 50),
  itemDescription: text("Item description", 300),
  category: text("Category", 60),
  uom: text("UOM", 30),
  plannedQty: nonNegative("Planned qty"),
  unitRate: nonNegative("Unit rate"),
});

export const projectSchema = z.object({
  name: text("Project name", 150),
  moNumber: text("MO number", 60),
  cwoNumber: text("CWO number", 60),
  siteName: text("Site name", 150),
  location: text("Location", 200),
  vendor: text("Vendor", 150),
  budget: nonNegative("Budget").default(0),
  status: z.enum(PROJECT_STATUSES).default("In Progress"),
  materials: z
    .array(materialSchema)
    .min(1, "Add at least one material item")
    .max(1000)
    .superRefine((items, ctx) => {
      const seen = new Set<string>();
      items.forEach((m, i) => {
        const code = m.itemCode.toUpperCase();
        if (seen.has(code)) {
          ctx.addIssue({ code: "custom", path: [i, "itemCode"], message: `Duplicate item code ${m.itemCode}` });
        }
        seen.add(code);
      });
    }),
});

export const usageSchema = z.object({
  materialId: z.string().regex(/^[a-f\d]{24}$/i, "Select a material"),
  quantity: z.coerce.number({ error: "Quantity must be a number" }).finite().positive("Quantity must be greater than 0"),
  date: z.coerce.date({ error: "Enter a valid date" }),
  remarks: z.string().trim().max(300).default(""),
});

export type ProjectInput = z.infer<typeof projectSchema>;
