import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.middleware";
import { BookModel } from "../models/book.model";
import { LoanModel } from "../models/loan.model";
import { UserModel } from "../models/user.model";
import {
  getCurrentLoans,
  getPopulatedBookSummary,
} from "../utils/loanQueries";
import { getDisplayStatus } from "../utils/loanStatus";

const router = Router();

router.get("/member", authenticate, authorize("member"), async (req, res, next) => {
  if (!req.auth) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }

  try {
    const loans = await getCurrentLoans(req.auth.userId);
    const currentLoans = loans.map((loan) => ({
      id: loan.id,
      book: getPopulatedBookSummary(loan.book),
      dueDate: loan.dueDate,
      displayStatus: getDisplayStatus(loan),
    }));
    const overdueLoans = currentLoans.filter(
      (loan) => loan.displayStatus === "Overdue",
    );

    res.status(200).json({
      currentLoans,
      overdueLoans,
      counts: {
        current: currentLoans.length,
        overdue: overdueLoans.length,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get("/admin", authenticate, authorize("admin"), async (_req, res, next) => {
  try {
    const now = new Date();
    const [
      totalMembers,
      totalBooks,
      activeBorrowings,
      overdueBorrowings,
      lowAvailabilityBooks,
    ] = await Promise.all([
      UserModel.countDocuments({ role: "member" }),
      BookModel.countDocuments(),
      LoanModel.countDocuments({ status: "borrowed" }),
      LoanModel.countDocuments({ status: "borrowed", dueDate: { $lt: now } }),
      BookModel.find({ availableCopies: { $lte: 2 } })
        .sort({ availableCopies: 1 })
        .exec(),
    ]);

    res.status(200).json({
      totalMembers,
      totalBooks,
      activeBorrowings,
      overdueBorrowings,
      lowAvailabilityBooks: lowAvailabilityBooks.map((book) => ({
        id: book.id,
        title: book.title,
        availableCopies: book.availableCopies,
        totalCopies: book.totalCopies,
      })),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
