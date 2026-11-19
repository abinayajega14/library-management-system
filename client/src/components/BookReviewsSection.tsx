import { useEffect, useState, type FormEvent } from "react";
import api from "../api/client";
import { getApiError, type ApiErrorDetails } from "../api/errors";
import Alert from "./Alert";
import Spinner from "./Spinner";
import type { ReviewSummary } from "../types/engagement";

interface ReviewResponse {
  review: {
    id: string;
    rating: number;
    comment: string;
    updatedAt: string;
  };
}

interface BookReviewsSectionProps {
  bookId: string;
}

export default function BookReviewsSection({ bookId }: BookReviewsSectionProps) {
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [rating, setRating] = useState("5");
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiErrorDetails | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    api
      .get<ReviewSummary>(`/books/${bookId}/reviews`, {
        signal: controller.signal,
      })
      .then(({ data }) => {
        if (!controller.signal.aborted) {
          setSummary(data);
          if (data.ownReview) {
            setRating(String(data.ownReview.rating));
            setComment(data.ownReview.comment);
          }
        }
      })
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted) {
          setError(getApiError(requestError));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [bookId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await api.post<ReviewResponse>(`/books/${bookId}/reviews`, {
        rating: Number(rating),
        comment: comment.trim(),
      });
      const { data } = await api.get<ReviewSummary>(`/books/${bookId}/reviews`);
      setSummary(data);
      setSuccess("Your review has been saved.");
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
      <header className="mb-5">
        <h2 className="text-xl font-semibold text-slate-900">Ratings and reviews</h2>
        {summary && (
          <p className="mt-1 text-sm text-slate-600">
            {summary.averageRating === null
              ? "No ratings yet"
              : `${summary.averageRating} / 5 average`}{" "}
            · {summary.reviewCount}{" "}
            {summary.reviewCount === 1 ? "review" : "reviews"}
          </p>
        )}
      </header>
      {error && (
        <div className="mb-4">
          <Alert variant="error" message={error.message} errors={error.errors} />
        </div>
      )}
      {success && (
        <div className="mb-4">
          <Alert variant="success" message={success} />
        </div>
      )}
      {loading ? (
        <Spinner label="Loading reviews…" />
      ) : (
        <div className="grid gap-8 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <form className="space-y-4" onSubmit={handleSubmit}>
            <h3 className="font-semibold text-slate-900">
              {summary?.ownReview ? "Update your review" : "Write a review"}
            </h3>
            <label className="block text-sm font-medium text-slate-700" htmlFor="book-rating">
              Rating
              <select
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                id="book-rating"
                onChange={(event) => setRating(event.target.value)}
                value={rating}
              >
                {[5, 4, 3, 2, 1].map((value) => (
                  <option key={value} value={value}>
                    {value} {value === 1 ? "star" : "stars"}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium text-slate-700" htmlFor="book-review">
              Review (optional)
              <textarea
                className="mt-1 block min-h-24 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                id="book-review"
                maxLength={1000}
                onChange={(event) => setComment(event.target.value)}
                value={comment}
              />
            </label>
            <button
              className="rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-60"
              disabled={saving}
              type="submit"
            >
              {saving ? "Saving…" : "Save review"}
            </button>
          </form>
          <div className="space-y-4">
            {summary?.reviews.map((review) => (
              <article className="border-b border-slate-100 pb-4 last:border-0" key={review.id}>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-semibold text-slate-900">{review.name}</h3>
                  <span className="text-sm font-medium text-amber-700">
                    {review.rating} / 5
                  </span>
                </div>
                {review.comment && (
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                    {review.comment}
                  </p>
                )}
              </article>
            ))}
            {summary?.reviews.length === 0 && (
              <p className="text-sm text-slate-600">Be the first to rate this book.</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
