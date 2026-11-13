import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/client";
import { getApiError, type ApiErrorDetails } from "../api/errors";
import Alert from "../components/Alert";
import LoanTable from "../components/LoanTable";
import Spinner from "../components/Spinner";
import type { LoanRecord } from "../types/loan";

interface LowAvailabilityBook {
  id: string;
  title: string;
  availableCopies: number;
  totalCopies: number;
}

interface AdminMember {
  id: string;
  name: string;
  email: string;
  loans: LoanRecord[];
}

interface AdminDashboardData {
  totalMembers: number;
  totalBooks: number;
  activeBorrowings: number;
  overdueBorrowings: number;
  lowAvailabilityBooks: LowAvailabilityBook[];
  members: AdminMember[];
}

const statLabels: Array<{
  key: keyof Omit<AdminDashboardData, "lowAvailabilityBooks" | "members">;
  label: string;
}> = [
  { key: "totalMembers", label: "Total Members" },
  { key: "totalBooks", label: "Total Books" },
  { key: "activeBorrowings", label: "Active Borrowings" },
  { key: "overdueBorrowings", label: "Overdue Borrowings" },
];

export default function AdminDashboardPage() {
  const [dashboard, setDashboard] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiErrorDetails | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

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
          <section className="mt-8">
            <h2 className="mb-3 text-xl font-semibold text-slate-900">Registered members</h2>
            {dashboard.members.length > 0 ? (
              <ul className="space-y-4">
                {dashboard.members.map((member) => {
                  const isSelected = selectedMemberId === member.id;
                  const detailsId = `member-details-${member.id}`;

                  return (
                    <li
                      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
                      key={member.id}
                    >
                      <button
                        aria-controls={isSelected ? detailsId : undefined}
                        aria-expanded={isSelected}
                        className="flex w-full items-center justify-between gap-3 text-left"
                        onClick={() =>
                          setSelectedMemberId(isSelected ? null : member.id)
                        }
                        type="button"
                      >
                        <span className="font-semibold text-slate-900">{member.name}</span>
                        <svg
                          aria-hidden="true"
                          className={`h-5 w-5 shrink-0 text-slate-500 transition-transform ${
                            isSelected ? "rotate-180" : ""
                          }`}
                          fill="none"
                          stroke="currentColor"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          viewBox="0 0 24 24"
                        >
                          <path d="m6 9 6 6 6-6" />
                        </svg>
                      </button>
                      {isSelected && (
                        <div className="mt-4 border-t border-slate-100 pt-4" id={detailsId}>
                          <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
                            <p className="text-sm text-slate-600">{member.email}</p>
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
                              {member.loans.length} {member.loans.length === 1 ? "loan" : "loans"}
                            </span>
                          </header>
                          {member.loans.length > 0 ? (
                            <LoanTable loans={member.loans} />
                          ) : (
                            <p className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-5 text-sm text-slate-600">
                              No borrowing history.
                            </p>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">
                No registered members.
              </p>
            )}
          </section>
        </>
      )}
    </section>
  );
}
