import { Router, type Request, type Response } from "express";
import { isValidObjectId, Types, type HydratedDocument } from "mongoose";
import { z } from "zod";
import { authenticate } from "../middleware/auth.middleware";
import { BookModel } from "../models/book.model";
import { LoanModel } from "../models/loan.model";
import { ReviewModel } from "../models/review.model";
import { WaitlistModel } from "../models/waitlist.model";
import type { User } from "../models/user.model";

const router = Router();

const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional(),
});

function respondWithInvalidId(res: Response): void {
  res.status(404).json({ message: "Book not found" });
}

function getBookId(req: Request): string | null {
  const { id } = req.params;
  return typeof id === "string" ? id : null;
}

async function getWaitlistState(bookId: string, userId: string) {
  const [entry, waiting] = await Promise.all([
    WaitlistModel.findOne({ book: bookId, user: userId }).exec(),
    WaitlistModel.countDocuments({ book: bookId }),
  ]);
  const position = entry
    ? (await WaitlistModel.countDocuments({
        book: bookId,
        $or: [
          { createdAt: { $lt: entry.createdAt } },
          { createdAt: entry.createdAt, _id: { $lt: entry._id } },
        ],
      })) + 1
    : null;

  return {
    position,
    waiting,
    canBorrow: waiting === 0 || position === 1,
  };
}

router.get("/:id/waitlist", authenticate, async (req, res, next) => {
  const bookId = getBookId(req);
  if (!bookId || !isValidObjectId(bookId)) {
    respondWithInvalidId(res);
    return;
  }
  if (!req.auth) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }
  const userId = req.auth.userId;

  try {
    const bookExists = await BookModel.exists({ _id: bookId });
    if (!bookExists) {
      respondWithInvalidId(res);
      return;
    }

    res.status(200).json({
      waitlist: await getWaitlistState(bookId, userId),
    });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/waitlist", authenticate, async (req, res, next) => {
  const bookId = getBookId(req);
  if (!bookId || !isValidObjectId(bookId)) {
    respondWithInvalidId(res);
    return;
  }
  if (!req.auth) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }
  const authUserId = req.auth.userId;

  try {
    const book = await BookModel.findById(bookId);
    if (!book) {
      respondWithInvalidId(res);
      return;
    }

    const userId = new Types.ObjectId(authUserId);
    const [existingEntry, activeLoan] = await Promise.all([
      WaitlistModel.findOne({ book: book.id, user: userId }).exec(),
      LoanModel.exists({ book: book.id, user: userId, status: "borrowed" }),
    ]);

    if (activeLoan) {
      res.status(409).json({ message: "You already have this book on loan" });
      return;
    }

    if (existingEntry) {
      res.status(200).json({
        message: "You are already on this waitlist",
        waitlist: await getWaitlistState(book.id, userId.toString()),
      });
      return;
    }

    if (book.availableCopies > 0) {
      res.status(409).json({ message: "This book is available to borrow" });
      return;
    }

    await WaitlistModel.create({ book: book._id, user: userId });
    res.status(201).json({
      message: "You joined the waitlist",
      waitlist: await getWaitlistState(book.id, userId.toString()),
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === 11000
    ) {
      try {
        res.status(200).json({
          message: "You are already on this waitlist",
          waitlist: await getWaitlistState(bookId, authUserId),
        });
      } catch (followUpError) {
        next(followUpError);
      }
      return;
    }

    next(error);
  }
});

router.delete("/:id/waitlist", authenticate, async (req, res, next) => {
  const bookId = getBookId(req);
  if (!bookId || !isValidObjectId(bookId)) {
    respondWithInvalidId(res);
    return;
  }
  if (!req.auth) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }
  const userId = req.auth.userId;

  try {
    const removed = await WaitlistModel.findOneAndDelete({
      book: bookId,
      user: userId,
    });

    if (!removed) {
      res.status(404).json({ message: "Waitlist entry not found" });
      return;
    }

    res.status(200).json({
      message: "You left the waitlist",
      waitlist: await getWaitlistState(bookId, userId),
    });
  } catch (error) {
    next(error);
  }
});

router.get("/:id/reviews", authenticate, async (req, res, next) => {
  const bookId = getBookId(req);
  if (!bookId || !isValidObjectId(bookId)) {
    respondWithInvalidId(res);
    return;
  }
  if (!req.auth) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }
  const userId = req.auth.userId;

  try {
    const bookExists = await BookModel.exists({ _id: bookId });
    if (!bookExists) {
      respondWithInvalidId(res);
      return;
    }

    const reviews = await ReviewModel.find({ book: bookId })
      .populate<{ user: HydratedDocument<User> | null }>("user", "name")
      .sort({ updatedAt: -1 })
      .exec();
    const ownReview = reviews.find(
      (review) => review.user?.id === userId,
    );
    const averageRating = reviews.length
      ? Math.round(
          (reviews.reduce((sum, review) => sum + review.rating, 0) /
            reviews.length) *
            10,
        ) / 10
      : null;

    res.status(200).json({
      averageRating,
      reviewCount: reviews.length,
      ownReview: ownReview
        ? {
            id: ownReview.id,
            rating: ownReview.rating,
            comment: ownReview.comment ?? "",
          }
        : null,
      reviews: reviews.map((review) => ({
        id: review.id,
        name: review.user?.name ?? "Library member",
        rating: review.rating,
        comment: review.comment ?? "",
        updatedAt: review.updatedAt,
      })),
    });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/reviews", authenticate, async (req, res, next) => {
  const bookId = getBookId(req);
  if (!bookId || !isValidObjectId(bookId)) {
    respondWithInvalidId(res);
    return;
  }
  if (!req.auth) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }
  const userId = req.auth.userId;

  const parsed = reviewSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      message: "Invalid review",
      errors: Object.fromEntries(
        parsed.error.issues.map(({ path, message }) => [path.join("."), message]),
      ),
    });
    return;
  }

  try {
    const bookExists = await BookModel.exists({ _id: bookId });
    if (!bookExists) {
      respondWithInvalidId(res);
      return;
    }

    const review = await ReviewModel.findOneAndUpdate(
      { book: bookId, user: userId },
      {
        $set: parsed.data,
        $setOnInsert: {
          book: new Types.ObjectId(bookId),
          user: new Types.ObjectId(userId),
        },
      },
      {
        upsert: true,
        returnDocument: "after",
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    );

    if (!review) {
      throw new Error("Unable to save review");
    }

    res.status(200).json({
      review: {
        id: review.id,
        rating: review.rating,
        comment: review.comment ?? "",
        updatedAt: review.updatedAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
