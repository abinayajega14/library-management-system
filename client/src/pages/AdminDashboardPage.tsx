import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/client";
import { getApiError, type ApiErrorDetails } from "../api/errors";
import Alert from "../components/Alert";
import Spinner from "../components/Spinner";

interface LowAvailabilityBook {
  id: string;
  title: string;
  availableCopies: number;
  totalCopies: number;
}

interface AdminDashboardData {
  totalMembers: number;
  totalBooks: number;
  activeBorrowings: number;
  overdueBorrowings: number;
  lowAvailabilityBooks: LowAvailabilityBook[];
}

const statLabels: Array<{ key: keyof Omit<AdminDashboardData, "lowAvailabilityBooks">; label: string }> = [
  { key: "totalMembers", label: "Total Members" },
  { key: "totalBooks", label: "Total Books" },
  { key: "activeBorrowings", label: "Active Borrowings" },
  { key: "overdueBorrowings", label: "Overdue Borrowings" },
];

export default function AdminDashboardPage() {
  const [dashboard, setDashboard] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiErrorDetails | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    api
      .get<AdminDashboardData>("/dashboard/admin", { signal: controller.signal })
      .then(({ data }) => setDashboard(data))
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

  return (
    <section>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-800">Library administration</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">Admin dashboard</h1>
        </div>
        <Link
          className="rounded-lg bg-emerald-800 px-4 py-2.5 font-semibold text-white hover:bg-emerald-900"
          to="/admin/books/new"
        >
          Add Book
        </Link>
      </header>
      {error && (
        <div className="mb-5">
          <Alert variant="error" message={error.message} errors={error.errors} />
        </div>
      )}
      {loading ? (
        <Spinner label="Loading admin dashboard…" />
      ) : error || !dashboard ? null : (
        <>
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {statLabels.map(({ key, label }) => (
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm" key={key}>
                <p className="text-sm font-medium text-slate-500">{label}</p>
                <p className="mt-2 text-3xl font-bold text-slate-900">{dashboard[key]}</p>
              </div>
            ))}
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
              <p className="text-sm font-medium text-amber-800">Low-availability count</p>
              <p className="mt-2 text-3xl font-bold text-amber-950">
                {dashboard.lowAvailabilityBooks.length}
              </p>
            </div>
          </div>
          <section>
            <h2 className="mb-3 text-xl font-semibold text-slate-900">Low-availability books</h2>
            {dashboard.lowAvailabilityBooks.length > 0 ? (
              <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
                {dashboard.lowAvailabilityBooks.map((book) => (
                  <li
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-4"
                    key={book.id}
                  >
                    <Link
                      className="font-semibold text-emerald-900 hover:underline"
                      to={`/books/${book.id}`}
                    >
                      {book.title}
                    </Link>
                    <span className="text-sm text-slate-600">
                      Available: {book.availableCopies} / {book.totalCopies}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">
                No low-availability books.
              </p>
            )}
          </section>
        </>
      )}
    </section>
  );
}
