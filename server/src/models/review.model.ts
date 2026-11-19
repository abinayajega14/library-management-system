import { model, Schema, Types } from "mongoose";

export interface Review {
  user: Types.ObjectId;
  book: Types.ObjectId;
  rating: number;
  comment?: string;
  createdAt: Date;
  updatedAt: Date;
}

const reviewSchema = new Schema<Review>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    book: { type: Schema.Types.ObjectId, ref: "Book", required: true },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      validate: {
        validator: Number.isInteger,
        message: "Rating must be a whole number from 1 to 5",
      },
    },
    comment: { type: String, trim: true, maxlength: 1000 },
  },
  { timestamps: true },
);

reviewSchema.index({ user: 1, book: 1 }, { unique: true });
reviewSchema.index({ book: 1, updatedAt: -1 });

export const ReviewModel = model<Review>("Review", reviewSchema);
