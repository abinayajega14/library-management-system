import type { Loan } from "../models/loan.model";

const millisecondsPerDay = 24 * 60 * 60 * 1000;

export function getDisplayStatus(
  loan: Pick<Loan, "status" | "dueDate">,
): "Borrowed" | "Returned" | "Overdue" {
  if (loan.status === "returned") {
    return "Returned";
  }

  return loan.dueDate < new Date() ? "Overdue" : "Borrowed";
}

export function getFineAmount(
  loan: Pick<Loan, "status" | "dueDate" | "returnedAt">,
  now = new Date(),
): number {
  const endDate = loan.status === "returned" ? loan.returnedAt : now;
  if (!endDate) {
    return 0;
  }

  const overdueMilliseconds = endDate.getTime() - loan.dueDate.getTime();
  return overdueMilliseconds > 0
    ? Math.ceil(overdueMilliseconds / millisecondsPerDay)
    : 0;
}
