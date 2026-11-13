import { useEffect, useState, type FormEvent } from "react";
import api from "../api/client";
import { getApiError, type ApiErrorDetails } from "../api/errors";
import Alert from "../components/Alert";
import BookCard from "../components/BookCard";
import Spinner from "../components/Spinner";
import type { BookListResponse } from "../types/book";

const pageSize = 12;

interface GenreResponse {
  genres: string[];
}

export default function CatalogPage() {
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [genre, setGenre] = useState("");
  const [page, setPage] = useState(1);
  const [genres, setGenres] = useState<string[]>([]);
  const [genreError, setGenreError] = useState<ApiErrorDetails | null>(null);
  const [results, setResults] = useState<BookListResponse | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [listError, setListError] = useState<{
    key: string;
    details: ApiErrorDetails;
  } | null>(null);

  const requestKey = JSON.stringify([submittedQuery, genre, page]);
  const loading = loadedKey !== requestKey;
  const activeListError = listError?.key === requestKey ? listError.details : null;

  useEffect(() => {
    const controller = new AbortController();
    api
      .get<GenreResponse>("/books/genres", { signal: controller.signal })
      .then(({ data }) => setGenres(data.genres))
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setGenreError(getApiError(error));
        }
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const params = {
      page,
      limit: pageSize,
      ...(submittedQuery ? { q: submittedQuery } : {}),
      ...(genre ? { genre } : {}),
    };

    api
      .get<BookListResponse>("/books", { params, signal: controller.signal })
      .then(({ data }) => {
        setResults(data);
        setLoadedKey(requestKey);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setListError({ key: requestKey, details: getApiError(error) });
          setLoadedKey(requestKey);
        }
      });

    return () => controller.abort();
  }, [genre, page, requestKey, submittedQuery]);

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setSubmittedQuery(query.trim());
  }

  function handleGenreChange(value: string) {
    setPage(1);
    setGenre(value);
  }

  return (
    <section>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-800">Shelfwise library</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">Explore the catalog</h1>
          <p className="mt-2 text-slate-600">Find your next read by title, author, or genre.</p>
        </div>
        <form className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row" onSubmit={handleSearch}>
          <label className="sr-only" htmlFor="book-search">
            Search by title or author
          </label>
          <input
            className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100 sm:w-64"
            id="book-search"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search title or author"
            type="search"
            value={query}
          />
          <label className="sr-only" htmlFor="genre-filter">
            Filter by genre
          </label>
          <select
            className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-700 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
            id="genre-filter"
            onChange={(event) => handleGenreChange(event.target.value)}
            value={genre}
          >
            <option value="">All genres</option>
            {genres.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <button
            className="rounded-lg bg-emerald-800 px-4 py-2.5 font-semibold text-white hover:bg-emerald-900"
            type="submit"
          >
            Search
          </button>
        </form>
      </div>

      {genreError && (
        <div className="mb-5">
          <Alert variant="error" message={genreError.message} errors={genreError.errors} />
        </div>
      )}
      {activeListError && (
        <div className="mb-5">
          <Alert
            variant="error"
            message={activeListError.message}
            errors={activeListError.errors}
          />
        </div>
      )}
      {loading ? (
        <Spinner label="Loading books…" />
      ) : activeListError ? null : results && results.items.length > 0 ? (
        <>
          <p className="mb-4 text-sm text-slate-600">
            {results.total} {results.total === 1 ? "book" : "books"} found
          </p>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {results.items.map((book) => (
              <BookCard book={book} key={book.id} />
            ))}
          </div>
          {results.pages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-4">
              <button
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={page <= 1}
                onClick={() => setPage((current) => current - 1)}
                type="button"
              >
                Previous
              </button>
              <span className="text-sm text-slate-600">
                Page {page} of {results.pages}
              </span>
              <button
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={page >= results.pages}
                onClick={() => setPage((current) => current + 1)}
                type="button"
              >
                Next
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
          <h2 className="text-lg font-semibold text-slate-900">No books found</h2>
          <p className="mt-1 text-sm text-slate-600">Try another title, author, or genre.</p>
        </div>
      )}
    </section>
  );
}
