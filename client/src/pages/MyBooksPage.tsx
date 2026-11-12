import { useEffect, useState } from "react";
import api from "../api/client";
import { getApiError, type ApiErrorDetails } from "../api/errors";
import Alert from "../components/Alert";
import LoanTable from "../components/LoanTable";
import Spinner from "../components/Spinner";
import type { LoanRecord } from "../types/loan";

interface CurrentLoansResponse {
  loans: LoanRecord[];
}

export default function MyBooksPage() {
  const [loans, setLoans] = useState<LoanRecord[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loadedKey, setLoadedKey] = useState<number | null>(null);
  const [fetchError, setFetchError] = useState<{
    key: number;
    details: ApiErrorDetails;
  } | null>(null);
  const [returnError, setReturnError] = useState<ApiErrorDetails | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [returningId, setReturningId] = useState<string | null>(null);

  const loading = loadedKey !== refreshKey;
  const activeFetchError = fetchError?.key === refreshKey ? fetchError.details : null;

  useEffect(() => {
    const controller = new AbortController();
    api
      .get<CurrentLoansResponse>("/loans/me/current", { signal: controller.signal })
      .then(({ data }) => {
        setLoans(data.loans);
        setLoadedKey(refreshKey);
        setFetchError(null);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setFetchError({ key: refreshKey, details: getApiError(error) });
          setLoadedKey(refreshKey);
        }
      });
    return () => controller.abort();
  }, [refreshKey]);

  async function returnBook(loan: LoanRecord) {
    setReturningId(loan.id);
    setReturnError(null);
    setNotice(null);
    try {
      await api.post(`/loans/${loan.id}/return`);
      setNotice(`Returned "${loan.book.title}".`);
      setRefreshKey((current) => current + 1);
    } catch (error) {
      setReturnError(getApiError(error));
    } finally {
      setReturningId(null);
    }
  }

  return (
    <section>
      <header className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-800">Member library</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">My Books</h1>
        <p className="mt-2 text-slate-600">View your active loans and return books when you’re done.</p>
      </header>
      {returnError && (
        <div className="mb-5">
          <Alert variant="error" message={returnError.message} errors={returnError.errors} />
        </div>
      )}
      {activeFetchError && (
        <div className="mb-5">
          <Alert
            variant="error"
            message={activeFetchError.message}
            errors={activeFetchError.errors}
          />
        </div>
      )}
      {notice && (
        <div className="mb-5">
          <Alert message={notice} variant="success" />
        </div>
      )}
      {loading ? (
        <Spinner label="Loading your books…" />
      ) : activeFetchError ? null : (
        <LoanTable
          loans={loans}
          onReturn={returnBook}
          returningId={returningId}
          showFine
        />
      )}
    </section>
  );
}
