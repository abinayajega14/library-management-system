import { model, Schema } from "mongoose";

export interface Book {
  title: string;
  author: string;
  genre: string;
  isbn: string;
  description?: string;
  coverImage?: string;
  totalCopies: number;
  availableCopies: number;
}

const bookSchema = new Schema<Book>({
  title: { type: String, required: true, trim: true },
  author: { type: String, required: true, trim: true },
  genre: { type: String, required: true, trim: true },
  isbn: { type: String, required: true, unique: true, trim: true },
  description: { type: String, trim: true },
  coverImage: { type: String, trim: true },
  totalCopies: {
    type: Number,
    required: true,
    min: 0,
    validate: {
      validator: Number.isInteger,
      message: "Total copies must be an integer",
    },
  },
  availableCopies: {
    type: Number,
    required: true,
    min: 0,
    validate: {
      validator: function (this: object, value: number): boolean {
        const totalCopies =
          "totalCopies" in this
            ? this.totalCopies
            : "get" in this && typeof this.get === "function"
              ? this.get("totalCopies")
              : undefined;
        return (
          Number.isInteger(value) &&
          typeof totalCopies === "number" &&
          value <= totalCopies
        );
      },
      message: "Available copies must be an integer no greater than total copies",
    },
  },
});

export const BookModel = model<Book>("Book", bookSchema);
