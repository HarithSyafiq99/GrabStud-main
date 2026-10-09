"use client";
import { useState, type FormEvent } from "react";
import { api } from "@/lib/client";
import type { BookingRecord } from "@/lib/types";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";
import { Modal } from "./Modal";
import { Notice } from "./UI";
import { LoadingLink } from "./LoadingLink";

type Props = { booking: BookingRecord; onUpdated: () => void | Promise<void> };
export function PickupRemark({
  booking,
  onUpdated,
  editable = false,
}: Props & { editable?: boolean }) {
  const [open, setOpen] = useState(false),
    [note, setNote] = useState(booking.pickup_note || ""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await api("/api/bookings/" + booking.id, {
        method: "PATCH",
        loadingLabel: "Saving your pickup remarks…",
        body: JSON.stringify({ action: "remark", pickup_note: note }),
      });
      await onUpdated();
      setOpen(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="pickup-remark">
        <Icon name="pin" size={17} />
        <div>
          <span>Pickup remarks</span>
          <p>{booking.pickup_note || "No extra pickup details added."}</p>
          {editable ? (
            <button
              type="button"
              className="pickup-edit"
              onClick={() => {
                setNote(booking.pickup_note || "");
                setError("");
                setOpen(true);
              }}
            >
              {booking.pickup_note
                ? "Edit remarks"
                : "Add a landmark or entrance"}
            </button>
          ) : null}
        </div>
      </div>
      <Modal
        open={open}
        title="Where should your driver meet you?"
        onClose={() => {
          if (!busy) setOpen(false);
        }}
      >
        <form onSubmit={save}>
          <label className="field">
            Pickup remarks
            <textarea
              className="input"
              rows={3}
              maxLength={300}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Library main entrance, beside the blue sign"
            />
          </label>
          <p className="text-xs muted">
            Share a nearby landmark or entrance. {note.length}/300 characters.
          </p>
          <Notice message={error} error />
          <div className="action-group mt-4">
            <button className="btn btn-primary" disabled={busy}>
              {busy ? "Saving…" : "Send to driver"}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
export function DriverDetails({ booking }: { booking: BookingRecord }) {
  if (!booking.driver_name) return null;
  return (
    <div className="driver-details">
      <Avatar name={booking.driver_name} photo={booking.driver_photo} />
      <div>
        <strong>{booking.driver_name}</strong>
        <div className="driver-rating-average">
          <Icon name="star" size={13} />
          {booking.driver_rating_count
            ? `${Number(booking.driver_rating_average).toFixed(1)}/5 · ${booking.driver_rating_count} ${booking.driver_rating_count === 1 ? "rating" : "ratings"}`
            : "No ratings yet"}
        </div>
        <p>
          {booking.car_colour && booking.car_type
            ? `${booking.car_colour} · ${booking.car_type}`
            : "Car details not added yet"}
        </p>
        {booking.car_plate ? (
          <span className="car-plate">{booking.car_plate}</span>
        ) : null}
        {booking.driver_phone ? (
          <a href={"tel:" + booking.driver_phone} className="driver-phone">
            <Icon name="phone" size={13} />
            {booking.driver_phone}
          </a>
        ) : null}
      </div>
    </div>
  );
}
export function ArrivalNotice({ booking, onUpdated }: Props) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  if (booking.status !== "accepted" || !booking.arrived_at) return null;
  async function acknowledge() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await api("/api/bookings/" + booking.id, {
        method: "PATCH",
        loadingLabel: "Letting your driver know…",
        body: JSON.stringify({ action: "acknowledge" }),
      });
      await onUpdated();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="arrival-notice" role="status" aria-live="polite">
      <span className="arrival-icon">
        <Icon
          name={booking.arrival_acknowledged_at ? "check" : "pin"}
          size={23}
        />
      </span>
      <div className="arrival-copy">
        <span className="eyebrow">PICKUP UPDATE</span>
        <h3>
          {booking.arrival_acknowledged_at
            ? "Your driver knows you’re on your way"
            : "Your driver has arrived"}
        </h3>
        <p>
          {booking.driver_name} is waiting at {booking.from_zone}.
          {booking.car_plate
            ? ` Look for ${booking.car_colour} ${booking.car_type}, plate ${booking.car_plate}.`
            : ""}
        </p>
        <Notice message={error} error />
      </div>
      {!booking.arrival_acknowledged_at ? (
        <button
          className="btn btn-primary"
          disabled={busy}
          onClick={acknowledge}
        >
          {busy ? "Sending…" : "I’m on my way"}
          <Icon name="arrow" size={15} />
        </button>
      ) : null}
    </section>
  );
}
export function DriverArrival({ booking, onUpdated }: Props) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function arrive() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await api("/api/bookings/" + booking.id, {
        method: "PATCH",
        loadingLabel: "Sending your arrival reminder…",
        body: JSON.stringify({ action: "arrive" }),
      });
      await onUpdated();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="driver-arrival">
      {booking.arrived_at ? (
        <p className="pickup-status">
          <Icon
            name={booking.arrival_acknowledged_at ? "check" : "bell"}
            size={16}
          />
          {booking.arrival_acknowledged_at
            ? "Passenger is on their way"
            : "Arrival reminder sent"}
        </p>
      ) : (
        <button className="btn btn-primary" disabled={busy} onClick={arrive}>
          <Icon name="pin" size={16} />
          {busy ? "Sending…" : "I’ve arrived"}
        </button>
      )}
      <p className="text-xs muted mt-2">
        {booking.arrived_at
          ? "Your passenger can see your pickup update. The agreed fare is recorded in your wallet."
          : "Send this when you reach the pickup point. The agreed fare will be added to your wallet."}
      </p>
      {booking.arrived_at ? (
        <LoadingLink href="/wallet" className="pickup-edit">
          View my wallet <Icon name="arrow" size={13} />
        </LoadingLink>
      ) : null}
      <Notice message={error} error />
    </div>
  );
}
