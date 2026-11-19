import { useEffect, useState } from "react";
import api from "../api/client";
import { getApiError, type ApiErrorDetails } from "../api/errors";
import Alert from "./Alert";
import BookCard from "./BookCard";
import Spinner from "./Spinner";
import type { RecentlyViewedBook } from "../types/engagement";

interface RecentlyViewedResponse {
  items: RecentlyViewedBook[];
}

export default function RecentlyViewedSection() {
  const [items, setItems] = useState<RecentlyViewedBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState<ApiErrorDetails | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    api
      .get<RecentlyViewedResponse>("/users/me/recently-viewed", {
        signal: controller.signal,
      })
      .then(({ data }) => {
        if (!controller.signal.aborted) {
          setItems(data.items);
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
  }, []);

  async function clearHistory() {
    setClearing(true);
    setError(null);
    try {
      await api.delete("/users/me/recently-viewed");
      setItems([]);
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setClearing(false);
    }
  }

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-slate-900">Recently viewed</h2>
        {items.length > 0 && (
          <button
            className="text-sm font-medium text-emerald-800 hover:underline disabled:opacity-50"
            disabled={clearing}
            onClick={clearHistory}
            type="button"
          >
            {clearing ? "Clearing…" : "Clear history"}
          </button>
        )}
      </div>
      {error && <Alert variant="error" message={error.message} errors={error.errors} />}
      {loading ? (
        <Spinner label="Loading recently viewed books…" />
      ) : items.length > 0 ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map(({ book }) => (
            <BookCard book={book} key={book.id} />
          ))}
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-6 text-sm text-slate-600">
          Books you open will appear here.
        </p>
      )}
    </section>
  );
}
