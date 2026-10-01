"use client";
import { useCallback, useEffect, useState } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import { Icon } from "@/components/Icon";
import { Notice, Stats, Empty } from "@/components/UI";
import { api, rideDate, rideTime } from "@/lib/client";
type Row = Record<string, string | number | null>;
export default function History() {
  const [rows, setRows] = useState<Row[]>([]),
    [role, setRole] = useState("passenger"),
    [filter, setFilter] = useState("all"),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(""),
    [cancel, setCancel] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      const d = await api<{ history: Row[]; role: string }>("/api/history");
      setRows(d.history);
      setRole(d.role);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
    const id = setInterval(load, 20000);
    return () => clearInterval(id);
  }, [load]);
  async function cancelBooking() {
    if (!cancel) return;
    setBusy(cancel);
    try {
      await api(`/api/bookings/${cancel}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "cancel" }),
      });
      setCancel(null);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  const list = rows.filter((r) => filter === "all" || r.status === filter);
  return (
    <div>
      <div className="page-heading">
        <div>
          <span className="eyebrow">EVERY JOURNEY HAS A STORY</span>
          <h1 className="mt-2">
            {role === "passenger"
              ? "Your campus journeys."
              : role === "admin"
                ? "All campus bookings."
                : "Your shared journeys."}
          </h1>
          <p>Keep track of bookings, confirmations, and good company.</p>
        </div>
        <div className="flex gap-2 print-hide">
          <a className="btn btn-secondary" href="/api/reports/history">
            <Icon name="file" size={15} />
            <span className="hidden sm:inline">Export</span> CSV
          </a>
          <button
            className="icon-btn"
            aria-label="Print report"
            onClick={() => window.print()}
          >
            <Icon name="file" size={17} />
          </button>
        </div>
      </div>
      <Stats
        items={[
          { label: "Total bookings", value: rows.length, icon: "history" },
          {
            label: "Accepted bookings",
            value: rows.filter((r) => r.status === "accepted").length,
            icon: "check",
          },
          {
            label: "Completed journeys",
            value: rows.filter((r) => r.status === "completed").length,
            icon: "car",
          },
        ]}
      />
      <Notice message={error} error />
      <div className="section-row">
        <div>
          <h2 className="section-title">Booking history</h2>
          <p className="section-subtitle">
            All times are shown in Malaysia time.
          </p>
        </div>
        <select
          className="input max-w-40 print-hide"
          aria-label="Filter booking status"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">All statuses</option>
          {["pending", "accepted", "completed", "rejected", "cancelled"].map(
            (s) => (
              <option key={s} value={s}>
                {s[0].toUpperCase() + s.slice(1)}
              </option>
            ),
          )}
        </select>
      </div>
      <div className="panel table-panel">
        <table className="data-table">
          <thead>
            <tr>
              <th>JOURNEY</th>
              <th>DEPARTURE</th>
              <th>FIXED RATE</th>
              <th>STATUS</th>
              <th>PAYMENT</th>
              {role === "passenger" ? (
                <th className="print-hide">MANAGE</th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {!loading &&
              list.map((r) => (
                <tr key={String(r.id)}>
                  <td>
                    <p>
                      {r.from_zone} → {r.to_zone}
                    </p>
                    <small>
                      {role === "driver"
                        ? r.passenger_name
                        : role === "admin"
                          ? `${r.passenger_name} · ${r.driver_name}`
                          : r.driver_name}
                    </small>
                  </td>
                  <td>
                    {rideDate(String(r.departure_at))}
                    <small>{rideTime(String(r.departure_at))}</small>
                  </td>
                  <td>RM {Number(r.flat_rate).toFixed(2)}</td>
                  <td>
                    <StatusBadge status={String(r.status)} />
                  </td>
                  <td className="uppercase muted">
                    {r.payment_method}
                    <small className="normal-case">
                      Paid to driver offline
                    </small>
                  </td>
                  {role === "passenger" ? (
                    <td className="print-hide">
                      {["pending", "accepted"].includes(String(r.status)) &&
                      new Date(String(r.departure_at)).getTime() >
                        Date.now() ? (
                        <button
                          className="btn btn-secondary"
                          disabled={!!busy}
                          onClick={() => setCancel(String(r.id))}
                        >
                          Cancel
                        </button>
                      ) : (
                        "—"
                      )}
                    </td>
                  ) : null}
                </tr>
              ))}
          </tbody>
        </table>
        {loading ? (
          <div className="skeleton m-5" />
        ) : !list.length ? (
          <Empty
            title="A fresh start."
            text="Your bookings will appear here as you share more journeys."
            icon="history"
          />
        ) : null}
      </div>
      {role === "passenger" ? (
        <div className="notice">
          <Icon name="wallet" size={17} />
          Pending means your request is awaiting driver approval. Pay cash or
          scan your driver’s QR after acceptance.
        </div>
      ) : null}
      {cancel ? (
        <div className="modal-backdrop" onClick={() => setCancel(null)}>
          <div
            className="modal-box max-w-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-booking-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="cancel-booking-title" className="section-title">
              Cancel your booking?
            </h2>
            <p className="text-xs muted leading-6 my-4">
              If your seat was confirmed, it will become available for another
              student.
            </p>
            <div className="action-group justify-end">
              <button
                className="btn btn-secondary"
                onClick={() => setCancel(null)}
              >
                Keep booking
              </button>
              <button
                className="btn btn-danger"
                disabled={!!busy}
                onClick={cancelBooking}
              >
                Cancel booking
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
