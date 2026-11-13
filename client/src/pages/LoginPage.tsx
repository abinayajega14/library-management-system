import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getApiError, type ApiErrorDetails } from "../api/errors";
import Alert from "../components/Alert";
import FieldError from "../components/FieldError";
import { useAuth } from "../context/useAuth";
import { validateEmail, validatePassword } from "../utils/validation";

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<ApiErrorDetails | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const errors: Record<string, string> = {};
    const emailError = validateEmail(email);
    const passwordError = validatePassword(password);
    if (emailError) errors.email = emailError;
    if (passwordError) errors.password = passwordError;
    setFieldErrors(errors);
    setApiError(null);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      const user = await login(email.trim(), password);
      navigate(user.role === "admin" ? "/admin" : "/dashboard", { replace: true });
    } catch (error) {
      setApiError(getApiError(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <h1 className="text-2xl font-bold text-slate-900">Welcome back</h1>
      <p className="mt-1 text-sm text-slate-600">Log in to manage your library account.</p>
      {apiError && (
        <div className="mt-5">
          <Alert variant="error" message={apiError.message} errors={apiError.errors} />
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
          <FieldError id="email-error" message={fieldErrors.email} />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700" htmlFor="password">
            Password
          </label>
          <input
            autoComplete="current-password"
            className={inputClass}
            id="password"
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            value={password}
          />
          <FieldError id="password-error" message={fieldErrors.password} />
        </div>
        <div className="text-right">
          <Link className="text-sm font-medium text-emerald-800 hover:underline" to="/forgot-password">
            Forgot password?
          </Link>
        </div>
        <button
          className="w-full rounded-lg bg-emerald-800 px-4 py-2.5 font-semibold text-white hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={submitting}
          type="submit"
        >
          {submitting ? "Logging in…" : "Log in"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-600">
        New to Shelfwise?{" "}
        <Link className="font-semibold text-emerald-800 hover:underline" to="/register">
          Create an account
        </Link>
      </p>
    </section>
  );
}
