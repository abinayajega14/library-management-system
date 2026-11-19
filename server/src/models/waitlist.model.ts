import { model, Schema, Types } from "mongoose";

export interface WaitlistEntry {
  user: Types.ObjectId;
  book: Types.ObjectId;
  createdAt: Date;
}

const waitlistSchema = new Schema<WaitlistEntry>({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true },
  book: { type: Schema.Types.ObjectId, ref: "Book", required: true },
  createdAt: { type: Date, default: Date.now, required: true },
});

waitlistSchema.index({ user: 1, book: 1 }, { unique: true });
waitlistSchema.index({ book: 1, createdAt: 1, _id: 1 });

export const WaitlistModel = model<WaitlistEntry>("WaitlistEntry", waitlistSchema);
