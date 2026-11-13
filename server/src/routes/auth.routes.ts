import { Router } from "express";
import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";
import type { HydratedDocument } from "mongoose";
import { z } from "zod";
import { getJwtSecret } from "../config/jwt";
import { authenticate } from "../middleware/auth.middleware";
import { UserModel, type User } from "../models/user.model";

const router = Router();

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("A valid email is required"),
  password: z.string().min(1, "Password is required"),
});

const registrationSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.string().trim().toLowerCase().email("A valid email is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email("A valid email is required"),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

function toSafeUser(user: HydratedDocument<User>) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone,
    address: user.address,
    membershipExpiresAt: user.membershipExpiresAt,
    createdAt: user.createdAt,
  };
}

router.post("/login", async (req, res, next) => {
  const parsed = loginSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      message: "Invalid login data",
      errors: Object.fromEntries(
        parsed.error.issues.map(({ path, message }) => [path.join("."), message]),
      ),
    });
    return;
  }

  const { email, password } = parsed.data;

  try {
    const user = await UserModel.findOne({ email }).select("+passwordHash");

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      res.status(401).json({ message: "Invalid email or password" });
      return;
    }

    const token = jwt.sign(
      { role: user.role },
      getJwtSecret(),
      { subject: user.id, expiresIn: "7d" },
    );

    res.status(200).json({ token, user: toSafeUser(user) });
  } catch (error) {
    next(error);
  }
});

router.post("/register", async (req, res, next) => {
  const parsed = registrationSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      message: "Invalid registration data",
      errors: Object.fromEntries(
        parsed.error.issues.map(({ path, message }) => [path.join("."), message]),
      ),
    });
    return;
  }

  const { name, email, password } = parsed.data;

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await UserModel.create({
      name,
      email,
      passwordHash,
      role: "member",
    });

    res.status(201).json({ user: toSafeUser(user) });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === 11000
    ) {
      res.status(409).json({ message: "An account with this email already exists" });
      return;
    }

    next(error);
  }
});

router.get("/me", authenticate, async (req, res, next) => {
  if (!req.auth) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }

  try {
    const user = await UserModel.findById(req.auth.userId);

    if (!user) {
      res.status(401).json({ message: "Authentication required" });
      return;
    }

    res.status(200).json({ user: toSafeUser(user) });
  } catch (error) {
    next(error);
  }
});

router.post("/forgot-password", async (req, res, next) => {
  const parsed = forgotPasswordSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      message: "Invalid password reset data",
      errors: Object.fromEntries(
        parsed.error.issues.map(({ path, message }) => [path.join("."), message]),
      ),
    });
    return;
  }

  try {
    const resetToken = randomBytes(32).toString("hex");
    const resetTokenHash = createHash("sha256").update(resetToken).digest("hex");
    const resetTokenExpires = new Date(Date.now() + 15 * 60 * 1000);
    const user = await UserModel.findOneAndUpdate(
      { email: parsed.data.email },
      { $set: { resetTokenHash, resetTokenExpires } },
      { new: false },
    );

    const response: { message: string; resetToken?: string } = {
      message: "If an account exists, a reset link has been generated.",
    };

    if (user && process.env.NODE_ENV !== "production") {
      response.resetToken = resetToken;
      const clientUrl = process.env.CLIENT_URL ?? "http://localhost:5173";
      console.log(
        `Password reset link: ${clientUrl.replace(/\/$/, "")}/reset-password?token=${resetToken}`,
      );
    }

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

router.post("/reset-password", async (req, res, next) => {
  const parsed = resetPasswordSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      message: "Invalid password reset data",
      errors: Object.fromEntries(
        parsed.error.issues.map(({ path, message }) => [path.join("."), message]),
      ),
    });
    return;
  }

  try {
    const resetTokenHash = createHash("sha256").update(parsed.data.token).digest("hex");
    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    const user = await UserModel.findOneAndUpdate(
      {
        resetTokenHash,
        resetTokenExpires: { $gt: new Date() },
      },
      {
        $set: { passwordHash },
        $unset: { resetTokenHash: 1, resetTokenExpires: 1 },
      },
      { new: false },
    );

    if (!user) {
      res.status(400).json({ message: "Invalid or expired reset token" });
      return;
    }

    res.status(200).json({ message: "Password has been reset" });
  } catch (error) {
    next(error);
  }
});

export default router;
