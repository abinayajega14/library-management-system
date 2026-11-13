import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/auth.middleware";
import { UserModel } from "../models/user.model";

const router = Router();

const updateProfileSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  phone: z
    .string()
    .trim()
    .max(25)
    .refine(
      (value) =>
        value === "" ||
        (/^[+()\d .-]+$/.test(value) &&
          (value.match(/\d/g)?.length ?? 0) >= 7 &&
          (value.match(/\d/g)?.length ?? 0) <= 15),
      "Enter a valid phone number",
    )
    .optional(),
  address: z.string().trim().max(200).optional(),
});

router.patch("/me", authenticate, async (req, res, next) => {
  if (!req.auth) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }

  const parsed = updateProfileSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      message: "Invalid profile data",
      errors: Object.fromEntries(
        parsed.error.issues.map(({ path, message }) => [path.join("."), message]),
      ),
    });
    return;
  }

  try {
    const user = await UserModel.findByIdAndUpdate(
      req.auth.userId,
      { $set: parsed.data },
      { new: true, runValidators: true },
    );

    if (!user) {
      res.status(401).json({ message: "Authentication required" });
      return;
    }

    res.status(200).json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        address: user.address,
        membershipExpiresAt: user.membershipExpiresAt,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
