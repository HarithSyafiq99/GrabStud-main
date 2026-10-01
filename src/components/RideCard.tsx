"use client";
import { useState } from "react";
import { StatusBadge } from "./StatusBadge";
import { Icon } from "./Icon";
import { api, rideDate, rideTime } from "@/lib/client";
import type { RideRecord } from "@/lib/types";
export function RideCard({
  ride,
  onBooked,
}: {
  ride: RideRecord & { booking_status?: string | null };
  onBooked?: () => void;
}) {
  const [payment, setPayment] = useState("cash"),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState(false);
  const full = ride.seats_available <= 0 || ride.status !== "open";
  const requested = ["pending", "accepted", "completed"].includes(
    ride.booking_status ?? "",
  );
  async function book() {
    setBusy(true);
    setMessage("");
    try {
      await api(`/api/rides/${ride.id}/book`, {
        method: "POST",
        body: JSON.stringify({ payment_method: payment }),
      });
      setMessage("Request sent! Your driver will confirm your seat.");
      setError(false);
      onBooked?.();
    } catch (e) {
      setMessage((e as Error).message);
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="panel ride-card">
      <div className="ride-card-top">
        <div className="ride-driver">
          <span className="avatar">
            {(ride.driver_name ?? "Student")
              .split(" ")
              .map((n) => n[0])
              .slice(0, 2)
              .join("")}
          </span>
          <div>
            <strong>{ride.driver_name ?? "Student driver"}</strong>
            <small>
              <Icon name="shield" size={10} className="inline mr-1" />
              Verified student
            </small>
          </div>
          <StatusBadge
            status={requested ? ride.booking_status! : full ? "full" : "open"}
          />
        </div>
        <div className="route-path">
          <p className="route-stop">{ride.from_zone}</p>
          <p className="route-stop">{ride.to_zone}</p>
        </div>
        <div className="ride-meta">
          <span>
            <Icon name="clock" size={13} />
            {rideTime(ride.departure_at)} · {rideDate(ride.departure_at)}
          </span>
          <span>
            <Icon name="users" size={13} />
            {ride.seats_available} seat{ride.seats_available !== 1 ? "s" : ""}
          </span>
        </div>
      </div>
      <div className="ride-card-bottom">
        <div className="ride-price">
          <strong>
            <small>RM </small>
            {Number(ride.flat_rate).toFixed(2)}
          </strong>
          <small>per person · fixed rate</small>
        </div>
        <div className="ride-booking">
          <select
            className="input"
            aria-label="Payment method"
            value={payment}
            onChange={(e) => setPayment(e.target.value)}
            disabled={full || requested}
          >
            <option value="cash">Cash</option>
            <option value="qr">QR pay</option>
          </select>
          <button
            className="btn btn-primary"
            disabled={busy || full || requested}
            onClick={book}
          >
            {busy
              ? "Sending…"
              : requested
                ? ride.booking_status === "accepted"
                  ? "Seat confirmed"
                  : "Requested"
                : full
                  ? "Fully booked"
                  : "Book a seat"}
            {!full && !requested ? <Icon name="arrow" size={13} /> : null}
          </button>
        </div>
        {message ? (
          <p
            className={`ride-message ${error ? "text-rose-600" : ""}`}
            role={error ? "alert" : "status"}
          >
            {message}
          </p>
        ) : null}
      </div>
    </article>
  );
}
