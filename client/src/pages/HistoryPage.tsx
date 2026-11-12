import { useEffect, useState } from "react";
import api from "../api/client";
import { getApiError, type ApiErrorDetails } from "../api/errors";
import Alert from "../components/Alert";
import LoanTable from "../components/LoanTable";
import Spinner from "../components/Spinner";
import type { LoanRecord } from "../types/loan";

interface LoanHistoryResponse {
  loans: LoanRecord[];
}

export default function HistoryPage() {
  const [loans, setLoans] = useState<LoanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiErrorDetails | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    api
      .get<LoanHistoryResponse>("/loans/me/history", { signal: controller.signal })
      .then(({ data }) => setLoans(data.loans))
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
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-800">Member library</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">Loan history</h1>
        <p className="mt-2 text-slate-600">Your returned and active loans, newest first.</p>
      </header>
      {error && (
        <div className="mb-5">
          <Alert variant="error" message={error.message} errors={error.errors} />
        </div>
      )}
      {loading ? (
        <Spinner label="Loading loan history…" />
      ) : (
        !error && <LoanTable loans={loans} showFine />
      )}
    </section>
  );
}
