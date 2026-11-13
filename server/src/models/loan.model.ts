import { model, Schema, Types } from "mongoose";

export type LoanStatus = "borrowed" | "returned";

export interface Loan {
  user: Types.ObjectId;
  book: Types.ObjectId;
  borrowedAt: Date;
  dueDate: Date;
  returnedAt: Date | null;
  status: LoanStatus;
}

const loanSchema = new Schema<Loan>({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true },
  book: { type: Schema.Types.ObjectId, ref: "Book", required: true },
  borrowedAt: { type: Date, required: true, default: Date.now },
  dueDate: { type: Date, required: true },
  returnedAt: { type: Date, default: null },
  status: {
    type: String,
    enum: ["borrowed", "returned"],
    required: true,
    default: "borrowed",
  },
});

loanSchema.index(
  { user: 1, book: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "borrowed" },
  },
);
loanSchema.index({ user: 1, status: 1 });

export const LoanModel = model<Loan>("Loan", loanSchema);
