import { Schema, model, models, type Model, type Types } from "mongoose";
import type { Role } from "@/lib/session";

export interface IUser {
  _id: Types.ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ["admin", "user"], default: "user", index: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const User: Model<IUser> = (models.User as Model<IUser>) || model<IUser>("User", UserSchema);
