import { useState } from "react";
import api from "../api/client";
import { getApiError, type ApiErrorDetails } from "../api/errors";
import Alert from "./Alert";
import BookCard from "./BookCard";
import Spinner from "./Spinner";
import type { BookRecommendation } from "../types/engagement";

interface RecommendationsResponse {
  recommendations: BookRecommendation[];
}

export default function RecommendationsSection() {
  const [recommendations, setRecommendations] = useState<BookRecommendation[] | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiErrorDetails | null>(null);

  async function loadRecommendations() {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get<RecommendationsResponse>("/recommendations");
      setRecommendations(data.recommendations);
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Recommended for you</h2>
          <p className="mt-1 text-sm text-slate-600">
            Gemini uses your reading activity to find your next book.
          </p>
        </div>
        <button
          className="rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-900 disabled:cursor-wait disabled:opacity-60"
          disabled={loading}
          onClick={loadRecommendations}
          type="button"
        >
          {loading ? "Finding books…" : recommendations ? "Refresh suggestions" : "Get suggestions"}
        </button>
      </div>
      {error && <Alert variant="error" message={error.message} errors={error.errors} />}
      {loading ? (
        <Spinner label="Finding book recommendations…" />
      ) : recommendations?.length ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {recommendations.map(({ book, reason }) => (
            <BookCard book={book} key={book.id}>
              <p className="border-t border-slate-100 pt-3 text-sm text-slate-600">
                {reason}
              </p>
            </BookCard>
          ))}
        </div>
      ) : recommendations ? (
        <p className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-6 text-sm text-slate-600">
          There are no recommendations yet. Browse a few books, borrow one, or leave
          a rating and try again.
        </p>
      ) : null}
    </section>
  );
}
