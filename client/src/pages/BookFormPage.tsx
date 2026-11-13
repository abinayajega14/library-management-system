import axios from "axios";
import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api/client";
import { getApiError, type ApiErrorDetails } from "../api/errors";
import Alert from "../components/Alert";
import FieldError from "../components/FieldError";
import Spinner from "../components/Spinner";
import type { Book } from "../types/book";

interface BookResponse {
  book: Book;
}

interface BookFormValues {
  title: string;
  author: string;
  genre: string;
  isbn: string;
  description: string;
  coverImage: string;
  totalCopies: string;
}

const emptyForm: BookFormValues = {
  title: "",
  author: "",
  genre: "",
  isbn: "",
  description: "",
  coverImage: "",
  totalCopies: "0",
};

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100";

function validateBook(form: BookFormValues): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of ["title", "author", "genre", "isbn"] as const) {
    if (!form[field].trim()) {
      errors[field] = `${field[0].toUpperCase()}${field.slice(1)} is required`;
    }
  }

  const normalizedIsbn = form.isbn.replace(/[\s-]/g, "");
  if (form.isbn.trim() && !/^\d{10}(?:\d{3})?$/.test(normalizedIsbn)) {
    errors.isbn = "ISBN must be 10 or 13 digits";
  }

  const totalCopies = Number(form.totalCopies);
  if (
    !form.totalCopies.trim() ||
    !Number.isInteger(totalCopies) ||
    totalCopies < 0
  ) {
    errors.totalCopies = "Total copies must be a non-negative whole number";
  }
  return errors;
}

function toFormValues(book: Book): BookFormValues {
  return {
    title: book.title,
    author: book.author,
    genre: book.genre,
    isbn: book.isbn,
    description: book.description ?? "",
    coverImage: book.coverImage ?? "",
    totalCopies: String(book.totalCopies),
  };
}

function getBookApiError(error: unknown): ApiErrorDetails {
  const details = getApiError(error);
  if (axios.isAxiosError(error) && error.response?.status === 409) {
    const message = details.message.toLowerCase();
    if (message.includes("isbn")) {
      details.errors.isbn = details.message;
    } else if (message.includes("total copies")) {
      details.errors.totalCopies = details.message;
    }
  }
  return details;
}

export default function BookFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [form, setForm] = useState<BookFormValues>(emptyForm);
  const [loadedBook, setLoadedBook] = useState<{ id: string; book: Book } | null>(null);
  const [loadError, setLoadError] = useState<{
    id: string;
    details: ApiErrorDetails;
  } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<ApiErrorDetails | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const book = loadedBook && loadedBook.id === id ? loadedBook.book : null;
  const activeLoadError = loadError && loadError.id === id ? loadError.details : null;
  const loading = Boolean(id) && !book && !activeLoadError;

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    api
      .get<BookResponse>(`/books/${id}`, { signal: controller.signal })
      .then(({ data }) => {
        if (!controller.signal.aborted) {
          setLoadedBook({ id, book: data.book });
          setForm(toFormValues(data.book));
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setLoadError({ id, details: getApiError(error) });
        }
      });
    return () => controller.abort();
  }, [id]);

  function updateField(field: keyof BookFormValues, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationErrors = validateBook(form);
    setFieldErrors(validationErrors);
    setApiError(null);
    if (Object.keys(validationErrors).length > 0) return;

    const payload = {
      title: form.title.trim(),
      author: form.author.trim(),
      genre: form.genre.trim(),
      isbn: form.isbn.trim(),
      description: form.description.trim(),
      coverImage: form.coverImage.trim() || undefined,
      totalCopies: Number(form.totalCopies),
    };

    setSubmitting(true);
    try {
      const { data } = id
        ? await api.put<BookResponse>(`/books/${id}`, payload)
        : await api.post<BookResponse>("/books", payload);
      navigate(`/books/${data.book.id}`, { replace: true });
    } catch (error) {
      setApiError(getBookApiError(error));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <Spinner label="Loading book details…" />;
  }
  if (activeLoadError) {
    return <Alert variant="error" message={activeLoadError.message} errors={activeLoadError.errors} />;
  }
  if (id && !book) {
    return <Alert variant="error" message="Book not found" />;
  }

  function fieldError(field: keyof BookFormValues): string | undefined {
    return fieldErrors[field] ?? apiError?.errors[field];
  }

  return (
    <section className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <header className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-800">Library administration</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">
          {id ? "Edit book" : "Add a book"}
        </h1>
      </header>
      {apiError && (
        <div className="mb-5">
          <Alert variant="error" message={apiError.message} />
        </div>
      )}
      <form className="space-y-5" onSubmit={handleSubmit} noValidate>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-slate-700" htmlFor="title">Title</label>
            <input
              className={inputClass}
              id="title"
              onChange={(event) => updateField("title", event.target.value)}
              value={form.title}
            />
            <FieldError id="title-error" message={fieldError("title")} />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700" htmlFor="author">Author</label>
            <input
              className={inputClass}
              id="author"
              onChange={(event) => updateField("author", event.target.value)}
              value={form.author}
            />
            <FieldError id="author-error" message={fieldError("author")} />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700" htmlFor="genre">Genre</label>
            <input
              className={inputClass}
              id="genre"
              onChange={(event) => updateField("genre", event.target.value)}
              value={form.genre}
            />
            <FieldError id="genre-error" message={fieldError("genre")} />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700" htmlFor="isbn">ISBN</label>
            <input
              className={inputClass}
              id="isbn"
              onChange={(event) => updateField("isbn", event.target.value)}
              value={form.isbn}
            />
            <FieldError id="isbn-error" message={fieldError("isbn")} />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700" htmlFor="totalCopies">
              Total copies
            </label>
            <input
              className={inputClass}
              id="totalCopies"
              min="0"
              onChange={(event) => updateField("totalCopies", event.target.value)}
              type="number"
              value={form.totalCopies}
            />
            <FieldError id="totalCopies-error" message={fieldError("totalCopies")} />
          </div>
          {id && book && (
            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="availableCopies">
                Available copies
              </label>
              <input
                className={`${inputClass} bg-slate-100 text-slate-500`}
                id="availableCopies"
                readOnly
                type="number"
                value={book.availableCopies}
              />
              <p className="mt-1 text-xs text-slate-500">
                Available copies are managed by borrow and return activity.
              </p>
            </div>
          )}
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700" htmlFor="description">
            Description
          </label>
          <textarea
            className={inputClass}
            id="description"
            onChange={(event) => updateField("description", event.target.value)}
            rows={4}
            value={form.description}
          />
          <FieldError id="description-error" message={fieldError("description")} />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700" htmlFor="coverImage">
            Cover image URL
          </label>
          <input
            className={inputClass}
            id="coverImage"
            onChange={(event) => updateField("coverImage", event.target.value)}
            type="url"
            value={form.coverImage}
          />
          <FieldError id="coverImage-error" message={fieldError("coverImage")} />
        </div>
        <button
          className="rounded-lg bg-emerald-800 px-5 py-2.5 font-semibold text-white hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={submitting}
          type="submit"
        >
          {submitting ? "Saving…" : id ? "Save changes" : "Create book"}
        </button>
      </form>
    </section>
  );
}
