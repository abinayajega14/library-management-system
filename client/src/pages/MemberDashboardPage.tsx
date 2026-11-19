import { useEffect, useState } from "react";
import api from "../api/client";
import { getApiError, type ApiErrorDetails } from "../api/errors";
import Alert from "../components/Alert";
import RecentlyViewedSection from "../components/RecentlyViewedSection";
import RecommendationsSection from "../components/RecommendationsSection";
import LoanTable from "../components/LoanTable";
import Spinner from "../components/Spinner";
import type { LoanRecord } from "../types/loan";

interface MemberDashboardData {
  currentLoans: LoanRecord[];
  overdueLoans: LoanRecord[];
  counts: {
    current: number;
    overdue: number;
  };
}

export default function MemberDashboardPage() {
  const [dashboard, setDashboard] = useState<MemberDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiErrorDetails | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    api
      .get<MemberDashboardData>("/dashboard/member", { signal: controller.signal })
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
      <header className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-800">Your library</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">Dashboard</h1>
      </header>
      {error && (
        <div className="mb-5">
          <Alert variant="error" message={error.message} errors={error.errors} />
        </div>
      )}
      {loading ? (
        <Spinner label="Loading your dashboard…" />
      ) : error || !dashboard ? null : (
        <>
          <div className="mb-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-slate-500">Current loans</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">{dashboard.counts.current}</p>
            </div>
            <div className="rounded-xl border border-red-200 bg-red-50 p-5 shadow-sm">
              <p className="text-sm font-medium text-red-700">Overdue loans</p>
              <p className="mt-2 text-3xl font-bold text-red-900">{dashboard.counts.overdue}</p>
            </div>
          </div>
          <div className="space-y-8">
            <RecommendationsSection />
            <RecentlyViewedSection />
            <section>
              <h2 className="mb-3 text-xl font-semibold text-slate-900">Current books and due dates</h2>
              <LoanTable loans={dashboard.currentLoans} />
            </section>
            <section className="rounded-xl border border-red-200 bg-red-50 p-4 sm:p-5">
              <h2 className="mb-3 text-xl font-semibold text-red-900">
                Overdue books ({dashboard.counts.overdue})
              </h2>
              {dashboard.overdueLoans.length > 0 ? (
                <LoanTable loans={dashboard.overdueLoans} />
              ) : (
                <p className="rounded-lg bg-white/70 px-4 py-6 text-sm text-red-800">
                  You have no overdue books.
                </p>
              )}
            </section>
          </div>
        </>
      )}
    </section>
  );
}
