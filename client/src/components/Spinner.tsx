interface SpinnerProps {
  label?: string;
}

export default function Spinner({ label = "Loading" }: SpinnerProps) {
  return (
    <div className="flex items-center justify-center gap-3 py-12" role="status">
      <span className="size-5 animate-spin rounded-full border-2 border-emerald-700 border-t-transparent" />
      <span className="text-sm text-slate-600">{label}</span>
    </div>
  );
}
