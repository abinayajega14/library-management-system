import { model, Schema, Types } from "mongoose";

export interface RecentView {
  user: Types.ObjectId;
  book: Types.ObjectId;
  viewedAt: Date;
}

const recentViewSchema = new Schema<RecentView>({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true },
  book: { type: Schema.Types.ObjectId, ref: "Book", required: true },
  viewedAt: { type: Date, default: Date.now, required: true },
});

recentViewSchema.index({ user: 1, book: 1 }, { unique: true });
recentViewSchema.index({ user: 1, viewedAt: -1 });

export const RecentViewModel = model<RecentView>("RecentView", recentViewSchema);
