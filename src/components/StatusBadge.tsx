export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-amber-50 text-amber-700",
    approved: "bg-emerald-50 text-emerald-700",
    offered: "bg-violet-50 text-violet-700",
    accepted: "bg-emerald-50 text-emerald-700",
    rejected: "bg-rose-50 text-rose-700",
    cancelled: "bg-slate-100 text-slate-500",
    open: "bg-emerald-50 text-emerald-700",
    full: "bg-rose-50 text-rose-700",
    completed: "bg-sky-50 text-sky-700",
  };
  return (
    <span
      key={status}
      className={`status ${map[status] ?? "bg-lilac text-lilac-ink"}`}
    >
      {status === "open"
        ? "Available"
        : status === "offered"
          ? "Awaiting price approval"
          : status === "accepted"
            ? "Booked"
            : status}
    </span>
  );
}
