export type LoanDisplayStatus = "Borrowed" | "Returned" | "Overdue";

export interface LoanRecord {
  id: string;
  book: {
    title: string;
    author: string;
  };
  borrowedAt?: string;
  dueDate: string;
  returnedAt?: string | null;
  displayStatus: LoanDisplayStatus;
  fine?: number;
}
