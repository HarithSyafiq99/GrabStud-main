"use client";
import { useCallback, useEffect, useState } from "react";
import { DriverRating } from "@/components/DriverRating";
import { BookingOffer } from "@/components/BookingOffer";
import { BookingLocations } from "@/components/BookingLocations";
import { PassengerCount } from "@/components/PassengerCount";
import type { BookingRecord } from "@/lib/types";
import { BookingProgress } from "@/components/BookingProgress";
import { RouteLoading } from "@/components/RouteLoading";
import { DownloadButton } from "@/components/DownloadButton";
import { StatusBadge } from "@/components/StatusBadge";
import { Icon } from "@/components/Icon";
import { Notice, Stats, Empty } from "@/components/UI";
import { api, rideDate, rideTime } from "@/lib/client";
type Row = BookingRecord;
export default function History() {
  const [rows, setRows] = useState<Row[]>([]),
    [role, setRole] = useState("passenger"),
    [filter, setFilter] = useState("all"),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(""),
    [cancel, setCancel] = useState<string | null>(null);
  const load = useCallback(async (background = false) => {
    try {
      const d = await api<{ history: Row[]; role: string }>("/api/history", {
        feedback: background ? "background" : "blocking",
      });
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
    const id = setInterval(() => load(true), 20000);
    return () => clearInterval(id);
  }, [load]);
  async function cancelBooking() {
    if (!cancel || busy) return;
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
      <BookingProgress active={!!busy} label="Cancelling your booking…" />
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
          <DownloadButton
            url="/api/reports/history"
            filename="grabstudent-history.csv"
          >
            <span className="hidden sm:inline">Export</span> CSV
          </DownloadButton>
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
            label: "Booked journeys",
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
          {[
            "pending",
            "offered",
            "accepted",
            "completed",
            "rejected",
            "cancelled",
          ].map((s) => (
            <option key={s} value={s}>
              {s === "offered"
                ? "Awaiting price approval"
                : s === "accepted"
                  ? "Booked"
                  : s[0].toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>
      </div>
      <div className="panel table-panel">
        <table className="data-table mobile-card-table">
          <thead>
            <tr>
              <th>JOURNEY</th>
              <th>DEPARTURE</th>
              <th>PRICE</th>
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
                  <td data-label="Journey" className="mobile-card-title">
                    <p>
                      {r.from_zone} → {r.to_zone}
                    </p>
                    <small>
                      {role === "driver"
                        ? r.passenger_name
                        : role === "admin"
                          ? `${r.passenger_name} · ${r.driver_name || "Waiting for driver"}`
                          : r.driver_name || "Waiting for driver"}
                    </small>
                    {role === "driver" && r.passenger_phone ? (
                      <small>
                        <a href={"tel:" + r.passenger_phone}>
                          {r.passenger_phone}
                        </a>
                      </small>
                    ) : null}
                    {role === "passenger" && r.driver_phone ? (
                      <small>
                        <a href={"tel:" + r.driver_phone}>{r.driver_phone}</a>
                      </small>
                    ) : null}
                    {role === "passenger" && r.car_plate ? (
                      <small>
                        {r.car_colour} · {r.car_type} · {r.car_plate}
                      </small>
                    ) : null}
                    {r.pickup_note ? (
                      <small className="history-pickup">
                        Pickup: {r.pickup_note}
                      </small>
                    ) : null}
                    <PassengerCount count={r.passenger_count} />
                    <BookingLocations booking={r} />
                    {role !== "passenger" && r.rated_at ? (
                      <div className="ride-rating-saved">
                        <Icon name="star" size={16} />
                        <div>
                          <strong>{r.rating_score}/5 stars</strong>
                          <p>{r.rating_feedback || "No written feedback."}</p>
                        </div>
                      </div>
                    ) : null}
                    {role === "admin" ? (
                      <small>
                        {r.passenger_phone} / {r.driver_phone}
                      </small>
                    ) : null}
                  </td>
                  <td data-label="Departure">
                    {rideDate(String(r.departure_at))}
                    <small>{rideTime(String(r.departure_at))}</small>
                  </td>
                  <td data-label="Price">
                    {r.quoted_price == null
                      ? "Awaiting driver price"
                      : "RM " + (Number(r.quoted_price) / 100).toFixed(2)}
                  </td>
                  <td data-label="Status">
                    <StatusBadge status={String(r.status)} />
                  </td>
                  <td data-label="Payment" className="uppercase muted">
                    {r.payment_method}
                    <small className="normal-case">
                      Paid to driver offline
                    </small>
                  </td>
                  {role === "passenger" ? (
                    <td
                      data-label="Manage booking"
                      className="print-hide mobile-card-actions"
                    >
                      <DriverRating
                        booking={r}
                        onUpdated={load}
                        disabled={!!busy}
                      />
                      {r.status === "offered" &&
                      (r.ride_id == null ||
                        ["open", "full"].includes(String(r.ride_status))) &&
                      new Date(String(r.departure_at)).getTime() >
                        Date.now() ? (
                        <BookingOffer
                          id={String(r.id)}
                          price={Number(r.quoted_price)}
                          driverId={
                            r.driver_id == null ? null : String(r.driver_id)
                          }
                          onUpdated={load}
                          disabled={!!busy}
                        />
                      ) : null}
                      {["pending", "offered", "accepted"].includes(
                        String(r.status),
                      ) &&
                      new Date(String(r.departure_at)).getTime() >
                        Date.now() ? (
                        <button
                          className="btn btn-secondary"
                          disabled={!!busy}
                          onClick={() => {
                            setError("");
                            setCancel(String(r.id));
                          }}
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
          <RouteLoading label="Loading booking history…" />
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
          Pending requests await the driver’s price. Agree to the offer to book
          your seat, or decline it. Pay the agreed fare directly to your driver
          in cash or by QR. Declining a price makes your request available to
          other drivers.
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
              Your request and any confirmed booking will be cancelled.
            </p>
            <Notice message={error} error />
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
