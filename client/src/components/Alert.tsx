interface AlertProps {
  variant: "error" | "success";
  message: string;
  errors?: Record<string, string>;
}

export default function Alert({ variant, message, errors }: AlertProps) {
  return (
    <div
      className={`rounded-lg border px-4 py-3 text-sm ${
        variant === "error"
          ? "border-red-200 bg-red-50 text-red-800"
          : "border-emerald-200 bg-emerald-50 text-emerald-800"
      }`}
      role={variant === "error" ? "alert" : "status"}
    >
      <p className="font-medium">{message}</p>
      {errors && Object.keys(errors).length > 0 && (
        <ul className="mt-2 list-inside list-disc space-y-1">
          {Object.entries(errors).map(([field, error]) => (
            <li key={field}>
              <span className="font-medium">{field}:</span> {error}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
