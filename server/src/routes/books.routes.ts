import { Router, type Response } from "express";
import { isValidObjectId, type HydratedDocument } from "mongoose";
import { z } from "zod";
import { authenticate, authorize } from "../middleware/auth.middleware";
import { BookModel, type Book } from "../models/book.model";

const router = Router();

const isbnSchema = z
  .string()
  .trim()
  .transform((isbn) => isbn.replace(/[\s-]/g, ""))
  .refine((isbn) => /^\d{10}(?:\d{3})?$/.test(isbn), "ISBN must be 10 or 13 digits");

const editableBookFields = {
  title: z.string().trim().min(1, "Title is required"),
  author: z.string().trim().min(1, "Author is required"),
  genre: z.string().trim().min(1, "Genre is required"),
  isbn: isbnSchema,
  description: z.string().trim().optional(),
  coverImage: z.string().trim().url("Cover image must be a valid URL").optional(),
};

const createBookSchema = z.object({
  ...editableBookFields,
  totalCopies: z.number().int().min(0, "Total copies cannot be negative"),
});

const updateBookSchema = z.object({
  ...editableBookFields,
  totalCopies: z.number().int().min(0, "Total copies cannot be negative"),
}).partial();

const listBooksQuerySchema = z.object({
  q: z.string().trim().optional(),
  genre: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
});

function respondWithValidationError(
  res: Response,
  message: string,
  issues: z.ZodIssue[],
): void {
  res.status(400).json({
    message,
    errors: Object.fromEntries(
      issues.map(({ path, message: issueMessage }) => [
        path.join("."),
        issueMessage,
      ]),
    ),
  });
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toBookResponse(book: HydratedDocument<Book>) {
  return {
    id: book.id,
    title: book.title,
    author: book.author,
    genre: book.genre,
    isbn: book.isbn,
    description: book.description,
    coverImage: book.coverImage,
    totalCopies: book.totalCopies,
    availableCopies: book.availableCopies,
  };
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === 11000
  );
}

router.get("/", authenticate, async (req, res, next) => {
  const parsed = listBooksQuerySchema.safeParse(req.query);

  if (!parsed.success) {
    respondWithValidationError(res, "Invalid book search data", parsed.error.issues);
    return;
  }

  const { q, genre, page, limit } = parsed.data;
  const search = q ? new RegExp(escapeRegex(q), "i") : undefined;
  const filter = {
    ...(search ? { $or: [{ title: search }, { author: search }] } : {}),
    ...(genre ? { genre: new RegExp(`^${escapeRegex(genre)}$`, "i") } : {}),
  };

  try {
    const [books, total] = await Promise.all([
      BookModel.find(filter)
        .sort({ title: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      BookModel.countDocuments(filter),
    ]);

    res.status(200).json({
      items: books.map(toBookResponse),
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    next(error);
  }
});

router.get("/genres", authenticate, async (_req, res, next) => {
  try {
    const genres = await BookModel.distinct("genre");
    res.status(200).json({ genres: genres.sort((a, b) => a.localeCompare(b)) });
  } catch (error) {
    next(error);
  }
});

router.get("/:id", authenticate, async (req, res, next) => {
  if (!isValidObjectId(req.params.id)) {
    res.status(404).json({ message: "Book not found" });
    return;
  }

  try {
    const book = await BookModel.findById(req.params.id);

    if (!book) {
      res.status(404).json({ message: "Book not found" });
      return;
    }

    res.status(200).json({ book: toBookResponse(book) });
  } catch (error) {
    next(error);
  }
});

router.post("/", authenticate, authorize("admin"), async (req, res, next) => {
  const parsed = createBookSchema.safeParse(req.body);

  if (!parsed.success) {
    respondWithValidationError(res, "Invalid book data", parsed.error.issues);
    return;
  }

  try {
    const book = await BookModel.create({
      ...parsed.data,
      availableCopies: parsed.data.totalCopies,
    });

    res.status(201).json({ book: toBookResponse(book) });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      res.status(409).json({ message: "A book with this ISBN already exists" });
      return;
    }

    next(error);
  }
});

router.put("/:id", authenticate, authorize("admin"), async (req, res, next) => {
  if (!isValidObjectId(req.params.id)) {
    res.status(404).json({ message: "Book not found" });
    return;
  }

  const parsed = updateBookSchema.safeParse(req.body);

  if (!parsed.success) {
    respondWithValidationError(res, "Invalid book data", parsed.error.issues);
    return;
  }

  try {
    const book = await BookModel.findById(req.params.id);

    if (!book) {
      res.status(404).json({ message: "Book not found" });
      return;
    }

    const onLoan = book.totalCopies - book.availableCopies;
    const newTotal = parsed.data.totalCopies;

    if (newTotal !== undefined && newTotal < onLoan) {
      res.status(409).json({
        message: `Total copies cannot be less than the ${onLoan} copies currently borrowed`,
      });
      return;
    }

    const update = {
      ...parsed.data,
      ...(newTotal === undefined ? {} : { availableCopies: newTotal - onLoan }),
    };
    const updatedBook = await BookModel.findByIdAndUpdate(
      req.params.id,
      { $set: update },
      { new: true, runValidators: true },
    );

    if (!updatedBook) {
      res.status(404).json({ message: "Book not found" });
      return;
    }

    res.status(200).json({ book: toBookResponse(updatedBook) });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      res.status(409).json({ message: "A book with this ISBN already exists" });
      return;
    }

    next(error);
  }
});

export default router;
