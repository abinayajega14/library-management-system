interface FieldErrorProps {
  id: string;
  message?: string;
}

export default function FieldError({ id, message }: FieldErrorProps) {
  if (!message) {
    return null;
  }
  return (
    <p className="mt-1 text-sm text-red-700" id={id}>
      {message}
    </p>
  );
}
