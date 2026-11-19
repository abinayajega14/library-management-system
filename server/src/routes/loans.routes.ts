import { Router, type Response } from "express";
import { isValidObjectId, Types, type HydratedDocument } from "mongoose";
import { z } from "zod";
import { authenticate, authorize } from "../middleware/auth.middleware";
import { BookModel, type Book } from "../models/book.model";
import { LoanModel, type Loan } from "../models/loan.model";
import { UserModel } from "../models/user.model";
import { WaitlistModel } from "../models/waitlist.model";
import {
  getCurrentLoans,
  getPopulatedBookSummary,
} from "../utils/loanQueries";
import { getDisplayStatus, getFineAmount } from "../utils/loanStatus";

const router = Router();

const borrowSchema = z.object({
  bookId: z.string().refine(isValidObjectId, "A valid book id is required"),
});

type LoanResponseSource = Pick<
  Loan,
  "borrowedAt" | "dueDate" | "returnedAt" | "status"
> & {
  id: string;
  book: unknown;
};

function toLoanResponse(loan: LoanResponseSource) {
  return {
    id: loan.id,
    book: getPopulatedBookSummary(loan.book),
    borrowedAt: loan.borrowedAt,
    dueDate: loan.dueDate,
    returnedAt: loan.returnedAt,
    status: loan.status,
    displayStatus: getDisplayStatus(loan),
    fine: getFineAmount(loan),
  };
}

function respondWithValidationError(res: Response, issues: z.ZodIssue[]): void {
  res.status(400).json({
    message: "Invalid borrow data",
    errors: Object.fromEntries(
      issues.map(({ path, message }) => [path.join("."), message]),
    ),
  });
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === 11000
  );
}

router.post("/", authenticate, authorize("member", "admin"), async (req, res, next) => {
  const parsed = borrowSchema.safeParse(req.body);

  if (!parsed.success) {
    respondWithValidationError(res, parsed.error.issues);
    return;
  }

  if (!req.auth) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }

  const { bookId } = parsed.data;

  try {
    const user = await UserModel.findById(req.auth.userId);

    if (!user) {
      res.status(401).json({ message: "Authentication required" });
      return;
    }

    if (
      !user.name.trim() ||
      !user.phone?.trim() ||
      !user.address?.trim()
    ) {
      res.status(403).json({
        message: "Complete your profile with your name, phone, and address before borrowing",
      });
      return;
    }

    if (
      !user.membershipExpiresAt ||
      user.membershipExpiresAt.getTime() <= Date.now()
    ) {
      res.status(403).json({
        message: "Your membership has expired. Contact library administration to renew it",
      });
      return;
    }

    const book = await BookModel.findById(bookId);

    if (!book) {
      res.status(404).json({ message: "Book not found" });
      return;
    }

    const firstWaitlistEntry = await WaitlistModel.findOne({ book: book._id })
      .sort({ createdAt: 1, _id: 1 })
      .exec();
    if (
      firstWaitlistEntry &&
      firstWaitlistEntry.user.toString() !== req.auth.userId
    ) {
      res.status(409).json({
        message: "This copy is reserved for the next member on the waitlist",
      });
      return;
    }

    const activeLoanFilter = {
      user: new Types.ObjectId(req.auth.userId),
      status: "borrowed" as const,
    };
    const activeLoanCount = await LoanModel.countDocuments(activeLoanFilter);

    if (activeLoanCount >= 3) {
      res.status(409).json({ message: "Borrowing limit of 3 books reached" });
      return;
    }

    const borrowedAt = new Date();
    const dueDate = new Date(borrowedAt.getTime() + 14 * 24 * 60 * 60 * 1000);
    let loan: HydratedDocument<Loan>;

    try {
      loan = await LoanModel.create({
        user: new Types.ObjectId(req.auth.userId),
        book: new Types.ObjectId(bookId),
        borrowedAt,
        dueDate,
        returnedAt: null,
        status: "borrowed",
      });
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        res.status(409).json({ message: "You have already borrowed this book" });
        return;
      }

      throw error;
    }

    const activeLoanCountAfterInsert = await LoanModel.countDocuments(activeLoanFilter);

    if (activeLoanCountAfterInsert > 3) {
      await LoanModel.deleteOne({ _id: loan._id });
      res.status(409).json({ message: "Borrowing limit of 3 books reached" });
      return;
    }

    const updatedBook = await BookModel.findOneAndUpdate(
      { _id: bookId, availableCopies: { $gt: 0 } },
      { $inc: { availableCopies: -1 } },
      { new: true },
    );

    if (!updatedBook) {
      await LoanModel.deleteOne({ _id: loan._id });
      res.status(409).json({ message: "No copies available" });
      return;
    }

    if (firstWaitlistEntry) {
      await WaitlistModel.deleteOne({ _id: firstWaitlistEntry._id });
    }

    await loan.populate("book", "title author");
    res.status(201).json({ loan: toLoanResponse(loan) });
  } catch (error) {
    next(error);
  }
});

router.post(
  "/:id/return",
  authenticate,
  authorize("member", "admin"),
  async (req, res, next) => {
    if (!req.auth) {
      res.status(401).json({ message: "Authentication required" });
      return;
    }

    const loanId = req.params.id;
    if (!isValidObjectId(loanId)) {
      res.status(409).json({ message: "Loan not found or already returned" });
      return;
    }

    try {
      const loan = await LoanModel.findOneAndUpdate(
        { _id: loanId, user: req.auth.userId, status: "borrowed" },
        { $set: { status: "returned", returnedAt: new Date() } },
        { new: true },
      );

      if (!loan) {
        res.status(409).json({ message: "Loan not found or already returned" });
        return;
      }

      await BookModel.updateOne(
        { _id: loan.book },
        { $inc: { availableCopies: 1 } },
      );

      await loan.populate("book", "title author");
      res.status(200).json({ loan: toLoanResponse(loan) });
    } catch (error) {
      next(error);
    }
  },
);

router.get("/me/current", authenticate, authorize("member", "admin"), async (req, res, next) => {
  if (!req.auth) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }

  try {
    const loans = await getCurrentLoans(req.auth.userId);
    res.status(200).json({ loans: loans.map(toLoanResponse) });
  } catch (error) {
    next(error);
  }
});

router.get("/me/history", authenticate, authorize("member", "admin"), async (req, res, next) => {
  if (!req.auth) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }

  try {
    const loans = await LoanModel.find({ user: req.auth.userId })
      .populate<{ book: Pick<Book, "title" | "author"> }>("book", "title author")
      .sort({ borrowedAt: -1 })
      .exec();

    res.status(200).json({ loans: loans.map(toLoanResponse) });
  } catch (error) {
    next(error);
  }
});

export default router;
