import { useState } from "react";

interface PasswordInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: "current-password" | "new-password";
  className: string;
}

export default function PasswordInput({
  id,
  value,
  onChange,
  autoComplete,
  className,
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const label = visible ? "Hide password" : "Show password";

  return (
    <div className="relative">
      <input
        autoComplete={autoComplete}
        className={`${className} pr-11`}
        id={id}
        onChange={(event) => onChange(event.target.value)}
        type={visible ? "text" : "password"}
        value={value}
      />
      <button
        aria-controls={id}
        aria-label={label}
        aria-pressed={visible}
        className="absolute right-0 top-1 inline-flex h-[calc(100%-0.25rem)] items-center rounded-r-lg px-3 text-slate-500 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-700"
        onClick={() => setVisible((current) => !current)}
        type="button"
      >
        {visible ? (
          <svg
            aria-hidden="true"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
            viewBox="0 0 24 24"
          >
            <path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8" />
            <path d="M9.9 5.2A10.7 10.7 0 0112 5c5.5 0 9.5 7 9.5 7a16 16 0 01-3 3.8M6.2 6.2C3.9 7.7 2.5 12 2.5 12s4 7 9.5 7a9.9 9.9 0 004.1-.9" />
          </svg>
        ) : (
          <svg
            aria-hidden="true"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
            viewBox="0 0 24 24"
          >
            <path d="M2.5 12s4-7 9.5-7 9.5 7 9.5 7-4 7-9.5 7-9.5-7-9.5-7Z" />
            <circle cx="12" cy="12" r="2.5" />
          </svg>
        )}
      </button>
    </div>
  );
}
