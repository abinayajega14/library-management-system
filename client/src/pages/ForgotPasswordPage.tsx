import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import api from "../api/client";
import { getApiError, type ApiErrorDetails } from "../api/errors";
import Alert from "../components/Alert";
import FieldError from "../components/FieldError";
import { validateEmail } from "../utils/validation";

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100";

interface ForgotPasswordResponse {
  message: string;
  resetToken?: string;
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [fieldError, setFieldError] = useState<string>();
  const [apiError, setApiError] = useState<ApiErrorDetails | null>(null);
  const [success, setSuccess] = useState<string>();
  const [resetUrl, setResetUrl] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validateEmail(email);
    setFieldError(validationError);
    setApiError(null);
    setSuccess(undefined);
    setResetUrl(undefined);
    if (validationError) return;

    setSubmitting(true);
    try {
      const { data } = await api.post<ForgotPasswordResponse>("/auth/forgot-password", {
        email: email.trim(),
      });
      setSuccess(data.message);
      if (data.resetToken) {
        setResetUrl(
          `${window.location.origin}/reset-password?token=${encodeURIComponent(data.resetToken)}`,
        );
      }
    } catch (error) {
      setApiError(getApiError(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <h1 className="text-2xl font-bold text-slate-900">Reset your password</h1>
      <p className="mt-1 text-sm text-slate-600">
        Enter your account email and we’ll prepare a reset link.
      </p>
      {apiError && (
        <div className="mt-5">
          <Alert variant="error" message={apiError.message} errors={apiError.errors} />
        </div>
      )}
      {success && (
        <div className="mt-5 space-y-3">
          <Alert message={success} variant="success" />
          {resetUrl && (
            <p className="text-sm text-slate-700">
              Development reset link:{" "}
              <Link className="font-medium text-emerald-800 underline" to={resetUrl}>
                Continue to reset password
              </Link>
            </p>
          )}
        </div>
      )}
      <form className="mt-6 space-y-4" onSubmit={handleSubmit} noValidate>
        <div>
          <label className="text-sm font-medium text-slate-700" htmlFor="email">
            Email
          </label>
          <input
            autoComplete="email"
            className={inputClass}
            id="email"
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            value={email}
          />
          <FieldError id="email-error" message={fieldError} />
        </div>
        <button
          className="w-full rounded-lg bg-emerald-800 px-4 py-2.5 font-semibold text-white hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={submitting}
          type="submit"
        >
          {submitting ? "Sending…" : "Send reset link"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-600">
        Remember your password?{" "}
        <Link className="font-semibold text-emerald-800 hover:underline" to="/login">
          Log in
        </Link>
      </p>
    </section>
  );
}
