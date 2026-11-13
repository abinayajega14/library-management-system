import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../api/client";
import { getApiError, type ApiErrorDetails } from "../api/errors";
import Alert from "../components/Alert";
import FieldError from "../components/FieldError";
import { validatePassword } from "../utils/validation";

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100";

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [fieldError, setFieldError] = useState<string>();
  const [apiError, setApiError] = useState<ApiErrorDetails | null>(null);
  const [success, setSuccess] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validatePassword(password, 8);
    setFieldError(validationError);
    setApiError(null);
    setSuccess(undefined);
    if (validationError) return;

    setSubmitting(true);
    try {
      const { data } = await api.post<{ message: string }>("/auth/reset-password", {
        token,
        password,
      });
      setSuccess(data.message);
      setPassword("");
    } catch (error) {
      setApiError(getApiError(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <h1 className="text-2xl font-bold text-slate-900">Choose a new password</h1>
      <p className="mt-1 text-sm text-slate-600">Your new password must be at least 8 characters.</p>
      {apiError && (
        <div className="mt-5">
          <Alert variant="error" message={apiError.message} errors={apiError.errors} />
        </div>
      )}
      {success && (
        <div className="mt-5">
          <Alert message={success} variant="success" />
        </div>
      )}
      {!token && (
        <div className="mt-5">
          <Alert variant="error" message="A reset token is required. Request a new reset link." />
        </div>
      )}
      <form className="mt-6 space-y-4" onSubmit={handleSubmit} noValidate>
        <div>
          <label className="text-sm font-medium text-slate-700" htmlFor="password">
            New password
          </label>
          <input
            autoComplete="new-password"
            className={inputClass}
            disabled={!token}
            id="password"
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            value={password}
          />
          <FieldError id="password-error" message={fieldError} />
        </div>
        <button
          className="w-full rounded-lg bg-emerald-800 px-4 py-2.5 font-semibold text-white hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!token || submitting}
          type="submit"
        >
          {submitting ? "Updating password…" : "Update password"}
        </button>
      </form>
      {success && (
        <p className="mt-6 text-center text-sm">
          <Link className="font-semibold text-emerald-800 hover:underline" to="/login">
            Return to login
          </Link>
        </p>
      )}
    </section>
  );
}
