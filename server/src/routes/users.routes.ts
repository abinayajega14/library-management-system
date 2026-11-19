import { Router } from "express";
import { isValidObjectId, Types, type HydratedDocument } from "mongoose";
import { z } from "zod";
import { authenticate } from "../middleware/auth.middleware";
import { BookModel, type Book } from "../models/book.model";
import { RecentViewModel } from "../models/recent-view.model";
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

const recentViewSchema = z.object({
  bookId: z.string().refine(isValidObjectId, "A valid book id is required"),
});

router.get("/me/recently-viewed", authenticate, async (req, res, next) => {
  if (!req.auth) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }

  try {
    const views = await RecentViewModel.find({ user: req.auth.userId })
      .populate<{ book: HydratedDocument<Book> | null }>(
        "book",
        "title author genre isbn description coverImage totalCopies availableCopies",
      )
      .sort({ viewedAt: -1 })
      .limit(10)
      .exec();

    res.status(200).json({
      items: views.flatMap((view) =>
        view.book
          ? [
              {
                viewedAt: view.viewedAt,
                book: {
                  id: view.book.id,
                  title: view.book.title,
                  author: view.book.author,
                  genre: view.book.genre,
                  isbn: view.book.isbn,
                  description: view.book.description,
                  coverImage: view.book.coverImage,
                  totalCopies: view.book.totalCopies,
                  availableCopies: view.book.availableCopies,
                },
              },
            ]
          : [],
      ),
    });
  } catch (error) {
    next(error);
  }
});

router.post("/me/recently-viewed", authenticate, async (req, res, next) => {
  if (!req.auth) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }

  const parsed = recentViewSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      message: "Invalid recently viewed book",
      errors: Object.fromEntries(
        parsed.error.issues.map(({ path, message }) => [path.join("."), message]),
      ),
    });
    return;
  }

  try {
    const book = await BookModel.findById(parsed.data.bookId);
    if (!book) {
      res.status(404).json({ message: "Book not found" });
      return;
    }

    const userId = new Types.ObjectId(req.auth.userId);
    await RecentViewModel.updateOne(
      { user: userId, book: book._id },
      {
        $set: { viewedAt: new Date() },
        $setOnInsert: { user: userId, book: book._id },
      },
      { upsert: true },
    );

    const recentViews = await RecentViewModel.find({ user: userId })
      .sort({ viewedAt: -1 })
      .limit(10)
      .select("_id")
      .exec();
    await RecentViewModel.deleteMany({
      user: userId,
      _id: { $nin: recentViews.map((view) => view._id) },
    });

    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.delete("/me/recently-viewed", authenticate, async (req, res, next) => {
  if (!req.auth) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }

  try {
    await RecentViewModel.deleteMany({ user: req.auth.userId });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
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
