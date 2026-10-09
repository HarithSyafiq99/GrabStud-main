"use client";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { LoadingLink as Link } from "@/components/LoadingLink";
import { CurrentBookings } from "@/components/CurrentBookings";
import { ArrivalPopup } from "@/components/ArrivalPopup";
import { LocationField } from "@/components/LocationField";
import { PassengerCountPicker } from "@/components/PassengerCount";
import type { LocationPin } from "@/lib/locations";
import { BookingProgress } from "@/components/BookingProgress";
import { CampusScene } from "@/components/CampusScene";
import { Icon } from "@/components/Icon";
import { Notice, Stats } from "@/components/UI";
import { api, localDateTime } from "@/lib/client";
import type { BookingRecord } from "@/lib/types";
export default function Passenger() {
  const [pickupNote, setPickupNote] = useState("");
  const [passengerCount, setPassengerCount] = useState(1);
  const [pickupPin, setPickupPin] = useState<LocationPin | null>(null);
  const [destinationPin, setDestinationPin] = useState<LocationPin | null>(
    null,
  );
  const [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [departure, setDeparture] = useState(""),
    [payment, setPayment] = useState("cash"),
    [bookings, setBookings] = useState<BookingRecord[]>([]),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(""),
    [message, setMessage] = useState(""),
    [error, setError] = useState(false),
    [cancel, setCancel] = useState<string | null>(null);
  const [latest, setLatest] = useState<BookingRecord[]>([]);
  const loadVersion = useRef(0);
  const load = useCallback(async (background = false) => {
    const version = ++loadVersion.current;
    try {
      const feedback = background ? "background" : "blocking";
      const [data, current] = await Promise.all([
        api<{ bookings: BookingRecord[] }>("/api/bookings", { feedback }),
        api<{ bookings: BookingRecord[] }>("/api/bookings?latest=1", {
          feedback,
        }),
      ]);
      if (version !== loadVersion.current) return;
      setBookings(data.bookings);
      setLatest(current.bookings);
    } catch (e) {
      if (version !== loadVersion.current) return;
      setMessage((e as Error).message);
      setError(true);
    } finally {
      if (version === loadVersion.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
    const refresh = () => {
      if (!document.hidden) void load(true);
    };
    const timer = setInterval(refresh, 10000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [load]);
  async function create(e: FormEvent) {
    e.preventDefault();
    if (!pickupPin || !destinationPin) {
      setMessage("Find or mark both locations on the map before posting.");
      setError(true);
      return;
    }
    setBusy("create");
    setMessage("");
    try {
      await api("/api/bookings", {
        method: "POST",
        body: JSON.stringify({
          from_zone: from,
          to_zone: to,
          departure_at: departure ? departure + ":00+08:00" : "",
          payment_method: payment,
          pickup_note: pickupNote,
          passenger_count: passengerCount,
          pickup_lat: pickupPin?.lat ?? null,
          pickup_lng: pickupPin?.lng ?? null,
          destination_lat: destinationPin?.lat ?? null,
          destination_lng: destinationPin?.lng ?? null,
        }),
      });
      ++loadVersion.current;
      setLatest([]);
      setMessage(
        "Request posted. A driver can choose your journey and send a price for you to review.",
      );
      setError(false);
      setDeparture("");
      setPickupNote("");
      setPassengerCount(1);
      setPickupPin(null);
      setDestinationPin(null);
      setFrom("");
      setTo("");
      await load();
    } catch (e) {
      setMessage((e as Error).message);
      setError(true);
    } finally {
      setBusy("");
    }
  }
  async function cancelBooking() {
    if (!cancel || busy) return;
    setBusy(cancel);
    try {
      await api("/api/bookings/" + cancel, {
        method: "PATCH",
        body: JSON.stringify({ action: "cancel" }),
      });
      setCancel(null);
      setMessage("Your request was cancelled.");
      setError(false);
      await load();
    } catch (e) {
      setMessage((e as Error).message);
      setError(true);
    } finally {
      setBusy("");
    }
  }
  const sameLocation =
    pickupPin && destinationPin
      ? Math.abs(pickupPin.lat - destinationPin.lat) < 0.000001 &&
        Math.abs(pickupPin.lng - destinationPin.lng) < 0.000001
      : !!from.trim() && from.trim().toLowerCase() === to.trim().toLowerCase();
  return (
    <div>
      <ArrivalPopup
        bookings={latest}
        onUpdated={load}
        paused={!!cancel || !!busy}
      />
      <BookingProgress
        active={!!busy}
        label={
          busy === "create"
            ? "Posting your journey request…"
            : "Cancelling your booking…"
        }
      />
      <CurrentBookings
        bookings={latest}
        loading={loading}
        disabled={!!busy}
        onRefresh={load}
        onCancel={(id) => {
          setMessage("");
          setError(false);
          setCancel(id);
        }}
      />
      <div className="page-heading">
        <div>
          <span className="eyebrow">YOUR EVERYDAY, MADE EASIER</span>
          <h1 className="mt-2">Where do you want to go?</h1>
          <p>
            Enter your pickup and destination addresses, then find or adjust
            their map pins.
          </p>
        </div>
      </div>
      <section className="hero-card">
        <div>
          <span className="eyebrow">YOUR ROUTE. YOUR REQUEST.</span>
          <h2>
            Tell us where.
            <br />
            Share the journey.
          </h2>
          <p>
            Post your journey, review the driver&apos;s price, and agree before
            your booking is confirmed.
          </p>
          <div className="hero-pills">
            <span>
              <Icon name="shield" size={12} /> Verified drivers
            </span>
            <span>
              <Icon name="wallet" size={12} /> Agree on your fare
            </span>
          </div>
        </div>
        <CampusScene />
      </section>
      <Stats
        items={[
          {
            label: "Waiting for a driver",
            value: bookings.filter((b) => b.status === "pending").length,
            icon: "clock",
          },
          {
            label: "Price offers to review",
            value: bookings.filter((b) => b.status === "offered").length,
            icon: "wallet",
          },
          {
            label: "Booked journeys",
            value: bookings.filter((b) => b.status === "accepted").length,
            icon: "check",
          },
        ]}
      />
      <Notice message={message} error={error} />
      <div className="passenger-request-grid">
        <section className="panel create-panel">
          <h2 className="section-title">Request a journey</h2>
          <p className="section-subtitle">
            Fill in both addresses or choose them on the map. Your driver sees
            the matching pins, and you pay in cash or QR.
          </p>
          <form className="create-form" onSubmit={create}>
            <LocationField
              kind="pickup"
              name={from}
              pin={pickupPin}
              onNameChange={setFrom}
              onPinChange={setPickupPin}
            />
            <LocationField
              kind="destination"
              name={to}
              pin={destinationPin}
              onNameChange={setTo}
              onPinChange={setDestinationPin}
              nearby={pickupPin}
            />
            <PassengerCountPicker
              count={passengerCount}
              onChange={setPassengerCount}
              disabled={!!busy}
            />
            <label className="field">
              DATE & TIME - MALAYSIA
              <input
                className="input"
                type="datetime-local"
                required
                min={localDateTime()}
                value={departure}
                onChange={(e) => setDeparture(e.target.value)}
              />
            </label>
            <label className="field">
              PAYMENT METHOD
              <select
                className="input"
                value={payment}
                onChange={(e) => setPayment(e.target.value)}
              >
                <option value="cash">Cash</option>
                <option value="qr">QR pay</option>
              </select>
            </label>
            <label className="field col-span-full">
              Pickup remarks (optional)
              <textarea
                className="input"
                rows={2}
                maxLength={300}
                value={pickupNote}
                onChange={(e) => setPickupNote(e.target.value)}
                placeholder="e.g. Main gate, beside the security booth"
              />
              <small className="muted normal-case">
                Tell your driver which entrance or landmark to look for.{" "}
                {pickupNote.length}/300
              </small>
            </label>
            {sameLocation ? (
              <p className="text-xs text-rose-600 col-span-full">
                Choose different pickup and destination locations.
              </p>
            ) : null}
            {!pickupPin || !destinationPin ? (
              <p className="text-xs muted col-span-full">
                Link both addresses to their map pins to post your request.
              </p>
            ) : null}
            <button
              className="btn btn-primary col-span-full"
              disabled={
                !!busy || !!sameLocation || !pickupPin || !destinationPin
              }
            >
              <Icon name="plus" size={16} />
              {busy === "create" ? "Posting..." : "Post booking request"}
            </button>
          </form>
        </section>
      </div>
      <p className="text-xs muted mt-5">
        <Link className="text-lilac-deep" href="/history">
          View all bookings and journey history
        </Link>
      </p>
      {cancel ? (
        <div className="modal-backdrop" onClick={() => setCancel(null)}>
          <div
            className="modal-box max-w-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-request-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="cancel-request-title" className="section-title">
              Cancel this request?
            </h2>
            <p className="text-xs muted my-4">
              The request and any agreed booking will be cancelled.
            </p>
            <Notice message={error ? message : ""} error />
            <div className="action-group">
              <button
                className="btn btn-secondary"
                onClick={() => setCancel(null)}
              >
                Keep request
              </button>
              <button
                className="btn btn-danger"
                disabled={!!busy}
                onClick={cancelBooking}
              >
                Cancel request
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
