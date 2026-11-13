import { model, Schema } from "mongoose";

export type UserRole = "member" | "admin";

export interface User {
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  phone?: string;
  address?: string;
  membershipExpiresAt: Date;
  resetTokenHash?: string;
  resetTokenExpires?: Date;
  createdAt: Date;
}

const userSchema = new Schema<User>({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ["member", "admin"], default: "member", required: true },
  phone: { type: String, trim: true },
  address: { type: String, trim: true },
  membershipExpiresAt: {
    type: Date,
    required: true,
    default: () => new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
  },
  resetTokenHash: { type: String, select: false },
  resetTokenExpires: { type: Date, select: false },
  createdAt: { type: Date, default: Date.now, required: true },
});

export const UserModel = model<User>("User", userSchema);
