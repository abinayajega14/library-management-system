import { Link } from "react-router-dom";
import type { Book } from "../types/book";
import BookCover from "./BookCover";

interface BookCardProps {
  book: Book;
}

export default function BookCard({ book }: BookCardProps) {
  return (
    <Link
      className="group overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
      to={`/books/${book.id}`}
    >
      <div className="relative aspect-[4/3] bg-slate-100">
        <BookCover
          className="h-full w-full object-cover"
          author={book.author}
          coverImage={book.coverImage}
          genre={book.genre}
          key={book.id}
          title={book.title}
        />
        {book.availableCopies === 0 && (
          <span className="absolute left-3 top-3 rounded-full bg-slate-900/90 px-3 py-1 text-xs font-semibold text-white">
            Out of stock
          </span>
        )}
      </div>
      <div className="space-y-2 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">{book.genre}</p>
        <h2 className="line-clamp-2 text-lg font-semibold text-slate-900 group-hover:text-emerald-900">
          {book.title}
        </h2>
        <p className="text-sm text-slate-600">{book.author}</p>
        <p className="pt-1 text-sm font-medium text-slate-700">
          Available: {book.availableCopies} / {book.totalCopies}
        </p>
      </div>
    </Link>
  );
}
