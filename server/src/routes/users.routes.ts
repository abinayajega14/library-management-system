import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/auth.middleware";
import { UserModel } from "../models/user.model";

const router = Router();

const updateProfileSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  phone: z.string().trim().optional(),
  address: z.string().trim().optional(),
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
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
