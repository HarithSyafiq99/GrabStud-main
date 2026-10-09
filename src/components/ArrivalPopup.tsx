"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { api } from "@/lib/client";
import {
  getLoadingSnapshot,
  getServerLoadingSnapshot,
  subscribeLoading,
} from "@/lib/loading";
import type { BookingRecord } from "@/lib/types";
import { DriverDetails } from "./PickupDetails";
import { Icon } from "./Icon";
import { Modal } from "./Modal";
import { Notice } from "./UI";
import { useCurrentUser } from "./UserContext";

const arrivalKey = (booking: BookingRecord) =>
  `${booking.id}:${booking.arrived_at}`;

export function ArrivalPopup({
  bookings,
  onUpdated,
  paused = false,
}: {
  bookings: BookingRecord[];
  onUpdated: () => void | Promise<void>;
  paused?: boolean;
}) {
  const user = useCurrentUser();
  const storageKey = `grabstudent-arrivals:${user.id}`;
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [otherDialog, setOtherDialog] = useState(true);
  const task = useSyncExternalStore(
    subscribeLoading,
    getLoadingSnapshot,
    getServerLoadingSnapshot,
  );
  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(
        sessionStorage.getItem(storageKey) || "[]",
      );
      setDismissed(
        Array.isArray(saved)
          ? saved.filter((key) => typeof key === "string")
          : [],
      );
    } catch {
      // Dismissal still works in memory when browser storage is unavailable.
    }
    setReady(true);
  }, [storageKey]);
  useEffect(() => {
    const update = () =>
      setOtherDialog(
        !!document.querySelector('[role="dialog"]:not(.arrival-popup)'),
      );
    const frame = requestAnimationFrame(update);
    const observer = new MutationObserver(update);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);
  const booking = bookings.find(
    (item) =>
      item.status === "accepted" &&
      item.arrived_at &&
      !item.arrival_acknowledged_at &&
      !dismissed.includes(arrivalKey(item)),
  );
  if (!booking) return null;
  const key = arrivalKey(booking);
  function dismiss() {
    const next = [...dismissed, key];
    setDismissed(next);
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // The dashboard banner remains available even without browser storage.
    }
  }
  return (
    <ArrivalPopupMessage
      key={key}
      booking={booking}
      open={
        ready &&
        !!user.onboarding_seen_at &&
        !paused &&
        !otherDialog &&
        task?.mode !== "blocking"
      }
      onUpdated={onUpdated}
      onDismiss={dismiss}
    />
  );
}

function ArrivalPopupMessage({
  booking,
  open,
  onUpdated,
  onDismiss,
}: {
  booking: BookingRecord;
  open: boolean;
  onUpdated: () => void | Promise<void>;
  onDismiss: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function acknowledge() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await api(`/api/bookings/${booking.id}`, {
        method: "PATCH",
        loadingLabel: "Letting your driver know…",
        body: JSON.stringify({ action: "acknowledge" }),
      });
      onDismiss();
      await onUpdated();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      open={open}
      title="Your driver has arrived"
      className="arrival-popup"
      onClose={() => {
        if (!busy) onDismiss();
      }}
    >
      <div className="arrival-popup-heading">
        <span className="arrival-icon">
          <Icon name="pin" size={26} />
        </span>
        <div>
          <span className="eyebrow">READY FOR PICKUP</span>
          <p>
            {booking.driver_name || "Your driver"} is waiting at{" "}
            <strong>{booking.from_zone}</strong>.
          </p>
        </div>
      </div>
      <DriverDetails booking={booking} />
      <div className="arrival-popup-route">
        <span>
          <Icon name="arrow" size={16} /> To {booking.to_zone}
        </span>
        <strong>RM {(Number(booking.quoted_price) / 100).toFixed(2)}</strong>
      </div>
      {booking.pickup_note ? (
        <p className="arrival-popup-note">
          Your pickup remarks: {booking.pickup_note}
        </p>
      ) : null}
      <p className="text-xs muted mt-4">
        Check the car and plate number, then let your driver know you’re on your
        way.
      </p>
      <Notice message={error} error />
      <div className="action-group mt-4">
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy}
          onClick={acknowledge}
        >
          {busy ? "Sending…" : "I’m on my way"}
          <Icon name="arrow" size={16} />
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={busy}
          onClick={onDismiss}
        >
          View later
        </button>
      </div>
    </Modal>
  );
}
