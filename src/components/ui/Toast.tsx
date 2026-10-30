export default function Toast({
  message,
  kind = "info",
}: {
  message: string;
  kind?: "info" | "success" | "error";
}) {
  if (!message) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-4 right-4 z-50 max-w-sm rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg ${kind === "error" ? "bg-red-700" : kind === "success" ? "bg-emerald-700" : "bg-slate-800"}`}
    >
      {message}
    </div>
  );
}
