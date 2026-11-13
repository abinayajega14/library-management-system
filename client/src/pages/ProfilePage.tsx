import { useState, type FormEvent } from "react";
import api from "../api/client";
import { getApiError, type ApiErrorDetails } from "../api/errors";
import Alert from "../components/Alert";
import FieldError from "../components/FieldError";
import { type AuthUser } from "../context/auth-context";
import { useAuth } from "../context/useAuth";
import { validateRequired } from "../utils/validation";

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100";

interface ProfileForm {
  name: string;
  phone: string;
  address: string;
}

export default function ProfilePage() {
  const { user, updateUser } = useAuth();
  const [form, setForm] = useState<ProfileForm>(() => ({
    name: user?.name ?? "",
    phone: user?.phone ?? "",
    address: user?.address ?? "",
  }));
  const [fieldError, setFieldError] = useState<string>();
  const [apiError, setApiError] = useState<ApiErrorDetails | null>(null);
  const [success, setSuccess] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  function updateField(field: keyof ProfileForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validateRequired(form.name, "Name");
    setFieldError(validationError);
    setApiError(null);
    setSuccess(undefined);
    if (validationError) return;

    setSubmitting(true);
    try {
      const { data } = await api.patch<{ user: AuthUser }>("/users/me", {
        name: form.name.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
      });
      updateUser(data.user);
      setForm({
        name: data.user.name,
        phone: data.user.phone ?? "",
        address: data.user.address ?? "",
      });
      setSuccess("Your profile has been updated.");
    } catch (error) {
      setApiError(getApiError(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <h1 className="text-2xl font-bold text-slate-900">Your profile</h1>
      <p className="mt-1 text-sm text-slate-600">Update the contact details on your account.</p>
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
      <form className="mt-6 space-y-4" onSubmit={handleSubmit} noValidate>
        <div>
          <label className="text-sm font-medium text-slate-700" htmlFor="name">
            Full name
          </label>
          <input
            autoComplete="name"
            className={inputClass}
            id="name"
            onChange={(event) => updateField("name", event.target.value)}
            type="text"
            value={form.name}
          />
          <FieldError id="name-error" message={fieldError} />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700" htmlFor="email">
            Email
          </label>
          <input
            className={`${inputClass} bg-slate-100 text-slate-500`}
            id="email"
            readOnly
            type="email"
            value={user?.email ?? ""}
          />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700" htmlFor="phone">
            Phone
          </label>
          <input
            autoComplete="tel"
            className={inputClass}
            id="phone"
            onChange={(event) => updateField("phone", event.target.value)}
            type="tel"
            value={form.phone}
          />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700" htmlFor="address">
            Address
          </label>
          <textarea
            autoComplete="street-address"
            className={inputClass}
            id="address"
            onChange={(event) => updateField("address", event.target.value)}
            rows={3}
            value={form.address}
          />
        </div>
        <button
          className="rounded-lg bg-emerald-800 px-5 py-2.5 font-semibold text-white hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={submitting}
          type="submit"
        >
          {submitting ? "Saving…" : "Save profile"}
        </button>
      </form>
    </section>
  );
}
