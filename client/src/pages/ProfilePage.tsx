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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<ApiErrorDetails | null>(null);
  const [success, setSuccess] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  function updateField(field: keyof ProfileForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const errors: Record<string, string> = {};
    const nameError = validateRequired(form.name, "Name");
    const phoneError = validateRequired(form.phone, "Phone");
    const addressError = validateRequired(form.address, "Address");
    if (nameError) errors.name = nameError;
    if (phoneError) errors.phone = phoneError;
    if (addressError) errors.address = addressError;
    const digitsInPhone = form.phone.match(/\d/g)?.length ?? 0;
    if (!phoneError && (!/^[+()\d .-]+$/.test(form.phone) || digitsInPhone < 7 || digitsInPhone > 15)) {
      errors.phone = "Enter a valid phone number";
    }
    setFieldErrors(errors);
    setApiError(null);
    setSuccess(undefined);
    if (Object.keys(errors).length > 0) return;

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
      <p className="mt-1 text-sm text-slate-600">
        Your name, phone, and address must be complete before you can borrow books.
      </p>
      {/* <p className="mt-2 text-sm text-slate-600">
        Membership expires:{" "}
        <span className="font-medium text-slate-800">
          {user?.membershipExpiresAt
            ? new Date(user.membershipExpiresAt).toLocaleDateString(undefined, {
                dateStyle: "long",
              })
            : "Not set - contact library administration"}
        </span>
      </p> */}
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
            required
            onChange={(event) => updateField("name", event.target.value)}
            type="text"
            value={form.name}
          />
          <FieldError id="name-error" message={fieldErrors.name} />
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
            required
            onChange={(event) => updateField("phone", event.target.value)}
            type="tel"
            value={form.phone}
          />
          <FieldError id="phone-error" message={fieldErrors.phone} />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700" htmlFor="address">
            Address
          </label>
          <textarea
            autoComplete="street-address"
            className={inputClass}
            id="address"
            required
            onChange={(event) => updateField("address", event.target.value)}
            rows={3}
            value={form.address}
          />
          <FieldError id="address-error" message={fieldErrors.address} />
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
