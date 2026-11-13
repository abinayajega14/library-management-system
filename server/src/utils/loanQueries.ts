import type { Book } from "../models/book.model";
import { LoanModel } from "../models/loan.model";

export function getCurrentLoans(userId: string) {
  return LoanModel.find({ user: userId, status: "borrowed" })
    .populate("book", "title author")
    .sort({ dueDate: 1 })
    .exec();
}

export function getPopulatedBookSummary(book: unknown): Pick<Book, "title" | "author"> {
  if (
    typeof book !== "object" ||
    book === null ||
    !("title" in book) ||
    typeof book.title !== "string" ||
    !("author" in book) ||
    typeof book.author !== "string"
  ) {
    throw new Error("Loan book was not populated");
  }

  return { title: book.title, author: book.author };
}
