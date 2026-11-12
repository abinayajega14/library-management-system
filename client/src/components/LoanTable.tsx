import type { LoanRecord, LoanDisplayStatus } from "../types/loan";

interface LoanTableProps {
  loans: LoanRecord[];
  onReturn?: (loan: LoanRecord) => void;
  returningId?: string | null;
  showFine?: boolean;
}

const statusClass: Record<LoanDisplayStatus, string> = {
  Borrowed: "bg-blue-100 text-blue-800",
  Returned: "bg-slate-100 text-slate-700",
  Overdue: "bg-red-100 text-red-800",
};

function formatDate(value?: string | null): string {
  return value ? new Date(value).toLocaleDateString() : "—";
}

export default function LoanTable({
  loans,
  onReturn,
  returningId = null,
  showFine = false,
}: LoanTableProps) {
  const hasActions = Boolean(onReturn);
  const columnCount = 5 + (hasActions ? 1 : 0) + (showFine ? 1 : 0);

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table
        className={`w-full ${showFine ? "min-w-[760px]" : "min-w-[680px]"} divide-y divide-slate-200 text-left text-sm`}
      >
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3 font-semibold" scope="col">Book</th>
            <th className="px-4 py-3 font-semibold" scope="col">Borrowed</th>
            <th className="px-4 py-3 font-semibold" scope="col">Due date</th>
            <th className="px-4 py-3 font-semibold" scope="col">Returned</th>
            <th className="px-4 py-3 font-semibold" scope="col">Status</th>
            {showFine && <th className="px-4 py-3 font-semibold" scope="col">Fine (1/day)</th>}
            {hasActions && <th className="px-4 py-3 font-semibold" scope="col">Action</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {loans.length === 0 ? (
            <tr>
              <td
                className="px-4 py-8 text-center text-slate-500"
                colSpan={columnCount}
              >
                No loans to display.
              </td>
            </tr>
          ) : (
            loans.map((loan) => (
              <tr key={loan.id}>
                <td className="px-4 py-4">
                  <p className="font-semibold text-slate-900">{loan.book.title}</p>
                  <p className="mt-1 text-slate-500">{loan.book.author}</p>
                </td>
                <td className="px-4 py-4 text-slate-600">{formatDate(loan.borrowedAt)}</td>
                <td className="px-4 py-4 text-slate-600">{formatDate(loan.dueDate)}</td>
                <td className="px-4 py-4 text-slate-600">{formatDate(loan.returnedAt)}</td>
                <td className="px-4 py-4">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass[loan.displayStatus]}`}>
                    {loan.displayStatus}
                  </span>
                </td>
                {showFine && (
                  <td className="px-4 py-4 text-slate-600">{loan.fine ?? 0}</td>
                )}
                {hasActions && (
                  <td className="px-4 py-4">
                    <button
                      aria-label={`Return ${loan.book.title}`}
                      className="rounded-md border border-emerald-800 px-3 py-1.5 font-medium text-emerald-900 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={returningId !== null}
                      onClick={() => onReturn?.(loan)}
                      type="button"
                    >
                      {returningId === loan.id ? "Returning…" : "Return"}
                    </button>
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
