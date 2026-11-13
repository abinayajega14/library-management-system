import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../api/client";
import { getApiError, type ApiErrorDetails } from "../api/errors";
import Alert from "../components/Alert";
import BookCover from "../components/BookCover";
import Spinner from "../components/Spinner";
import { useAuth } from "../context/useAuth";
import type { Book } from "../types/book";

interface BookResponse {
  book: Book;
}

interface BorrowResponse {
  loan: {
    dueDate: string;
  };
}

function formatDueDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    dateStyle: "medium",
  });
}

export default function BookDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [bookResult, setBookResult] = useState<{ id: string; book: Book } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [borrowing, setBorrowing] = useState(false);
  const [bookError, setBookError] = useState<{
    id: string;
    details: ApiErrorDetails;
  } | null>(null);
  const [borrowError, setBorrowError] = useState<ApiErrorDetails | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const book = bookResult && bookResult.id === id ? bookResult.book : null;
  const pageError = bookError && bookError.id === id ? bookError.details : null;
  const bookLoading = Boolean(id) && !book && !pageError;

  const loadBook = useCallback(
    async () => {
      if (!id) return;

      try {
        const { data } = await api.get<BookResponse>(`/books/${id}`);
        setBookResult({ id, book: data.book });
        setBookError(null);
      } catch (error) {
        setBookError({ id, details: getApiError(error) });
      }
    },
    [id],
  );

  const refreshBook = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadBook();
    } finally {
      setRefreshing(false);
    }
  }, [loadBook]);

  useEffect(() => {
    const controller = new AbortController();
    if (id) {
      api
        .get<BookResponse>(`/books/${id}`, { signal: controller.signal })
        .then(({ data }) => {
          if (!controller.signal.aborted) {
            setBookResult({ id, book: data.book });
            setBookError(null);
          }
        })
        .catch((error: unknown) => {
          if (!controller.signal.aborted) {
            setBookError({ id, details: getApiError(error) });
          }
        });
    }
    return () => controller.abort();
  }, [id]);

  async function handleBorrow() {
    if (!book || borrowing) return;
    setBorrowing(true);
    setBorrowError(null);
    setSuccess(null);

    try {
      const { data } = await api.post<BorrowResponse>("/loans", { bookId: book.id });
      setSuccess(`Book borrowed. Due date: ${formatDueDate(data.loan.dueDate)}.`);
      await refreshBook();
    } catch (error) {
      setBorrowError(getApiError(error));
      await refreshBook();
    } finally {
      setBorrowing(false);
    }
  }

  if (!id) {
    return <Alert variant="error" message="Book not found" />;
  }
  if (bookLoading && !book) {
    return <Spinner label="Loading book details…" />;
  }
  if (!book) {
    return (
      <section className="mx-auto max-w-xl space-y-5">
        {pageError && (
          <Alert variant="error" message={pageError.message} errors={pageError.errors} />
        )}
        <Link className="font-semibold text-emerald-800 hover:underline" to="/">
          Back to catalog
        </Link>
      </section>
    );
  }

  return (
    <section>
      <Link className="mb-6 inline-block text-sm font-medium text-emerald-800 hover:underline" to="/">
        ← Back to catalog
      </Link>
      {pageError && (
        <div className="mb-5">
          <Alert variant="error" message={pageError.message} errors={pageError.errors} />
        </div>
      )}
      {borrowError && (
        <div className="mb-5">
          <Alert variant="error" message={borrowError.message} errors={borrowError.errors} />
        </div>
      )}
      {success && (
        <div className="mb-5">
          <Alert message={success} variant="success" />
        </div>
      )}
      <div className="grid gap-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <div className="overflow-hidden rounded-xl bg-slate-100">
          <BookCover
            className="aspect-[4/5] h-full w-full object-cover"
            author={book.author}
            coverImage={book.coverImage}
            genre={book.genre}
            key={book.id}
            title={book.title}
          />
        </div>
        <div className="flex flex-col items-start">
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-800">{book.genre}</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{book.title}</h1>
          <p className="mt-2 text-lg text-slate-600">by {book.author}</p>
          <dl className="mt-6 grid w-full grid-cols-2 gap-x-4 gap-y-3 border-y border-slate-200 py-5 text-sm">
            <dt className="text-slate-500">ISBN</dt>
            <dd className="font-medium text-slate-800">{book.isbn}</dd>
            <dt className="text-slate-500">Copies available</dt>
            <dd className="font-medium text-slate-800">
              {book.availableCopies} / {book.totalCopies}
              {refreshing && <span className="ml-2 text-xs text-slate-500">Updating…</span>}
            </dd>
          </dl>
          <div className="mt-5 w-full">
            <h2 className="font-semibold text-slate-900">About this book</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
              {book.description || "No description is available for this book."}
            </p>
          </div>
          <div className="mt-7">
            {user?.role === "admin" ? (
              <Link
                className="inline-flex rounded-lg bg-emerald-800 px-5 py-2.5 font-semibold text-white hover:bg-emerald-900"
                to={`/admin/books/${book.id}/edit`}
              >
                Edit book
              </Link>
            ) : (
              <button
                className="inline-flex min-w-36 items-center justify-center gap-2 rounded-lg bg-emerald-800 px-5 py-2.5 font-semibold text-white hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={book.availableCopies === 0 || borrowing}
                onClick={handleBorrow}
                type="button"
              >
                {borrowing && (
                  <span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                )}
                {borrowing
                  ? "Borrowing…"
                  : book.availableCopies === 0
                    ? "Unavailable"
                    : "Borrow"}
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
