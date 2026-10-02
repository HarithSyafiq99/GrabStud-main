"use client";
import { useState } from "react";
import { api } from "@/lib/client";
import { ActionButton, ACTION_SUCCESS_MS } from "@/components/ActionButton";
import { BookingProgress } from "@/components/BookingProgress";
export function BookingOffer({
  id,
  price,
  driverId,
  onUpdated,
  disabled = false,
}: {
  id: string;
  price: number;
  driverId: string | null;
  onUpdated: () => void | Promise<void>;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState<"confirm" | "decline" | null>(null),
    [confirmed, setConfirmed] = useState(false),
    [error, setError] = useState("");
  async function respond(action: "confirm" | "decline") {
    if (busy || disabled) return;
    setBusy(action);
    setError("");
    try {
      await api("/api/bookings/" + id, {
        method: "PATCH",
        body: JSON.stringify({
          action,
          quoted_price: price,
          driver_id: driverId,
        }),
      });
      if (action === "confirm") {
        setConfirmed(true);
        await new Promise((resolve) => setTimeout(resolve, ACTION_SUCCESS_MS));
      }
      await onUpdated();
    } catch (e) {
      setError((e as Error).message);
      await onUpdated();
    } finally {
      setBusy(null);
      setConfirmed(false);
    }
  }
  return (
    <div>
      <BookingProgress
        active={!!busy}
        success={confirmed}
        label={
          confirmed
            ? "Booking confirmed!"
            : busy === "confirm"
              ? "Confirming your booking…"
              : "Declining this price…"
        }
      />
      <p className="text-xs mb-2">
        Driver offer: <strong>RM {(price / 100).toFixed(2)}</strong> per
        passenger
      </p>
      <div className="action-group flex-wrap">
        <ActionButton
          loadingLabel="Confirming booking…"
          successLabel="Booking confirmed!"
          pending={busy === "confirm"}
          success={confirmed}
          disabled={!!busy || disabled}
          onClick={() => respond("confirm")}
        >
          Agree & book
        </ActionButton>
        <button
          className="btn btn-secondary"
          disabled={!!busy || disabled}
          onClick={() => respond("decline")}
        >
          {busy === "decline" ? "Declining…" : "Decline price"}
        </button>
      </div>
      {error ? (
        <p role="alert" className="text-xs text-rose-600 mt-2">
          {error}
        </p>
      ) : null}
    </div>
  );
}
