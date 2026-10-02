"use client";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { LoadingLink as Link } from "@/components/LoadingLink";
import { BookingOffer } from "@/components/BookingOffer";
import { BookingProgress } from "@/components/BookingProgress";
import { RouteLoading } from "@/components/RouteLoading";
import { StatusBadge } from "@/components/StatusBadge";
import { CampusScene } from "@/components/CampusScene";
import { Icon } from "@/components/Icon";
import { Notice, Stats, Empty } from "@/components/UI";
import { ZONES } from "@/lib/zones";
import { api, localDateTime, rideDate, rideTime } from "@/lib/client";
import type { BookingRecord } from "@/lib/types";
export default function Passenger() {
  const [from, setFrom] = useState<string>(ZONES[0]),
    [to, setTo] = useState<string>(ZONES[7]),
    [departure, setDeparture] = useState(""),
    [payment, setPayment] = useState("cash"),
    [bookings, setBookings] = useState<BookingRecord[]>([]),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(""),
    [message, setMessage] = useState(""),
    [error, setError] = useState(false),
    [cancel, setCancel] = useState<string | null>(null);
  const load = useCallback(async (background = false) => {
    try {
      const data = await api<{ bookings: BookingRecord[] }>("/api/bookings", {
        feedback: background ? "background" : "blocking",
      });
      setBookings(data.bookings);
    } catch (e) {
      setMessage((e as Error).message);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
    const timer = setInterval(() => load(true), 20000);
    return () => clearInterval(timer);
  }, [load]);
  async function create(e: FormEvent) {
    e.preventDefault();
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
        }),
      });
      setMessage(
        "Request posted. A driver can choose your journey and send a price for you to review.",
      );
      setError(false);
      setDeparture("");
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
  return (
    <div>
      <BookingProgress
        active={!!busy}
        label={
          busy === "create"
            ? "Posting your journey request…"
            : "Cancelling your booking…"
        }
      />
      <div className="page-heading">
        <div>
          <span className="eyebrow">YOUR EVERYDAY, MADE EASIER</span>
          <h1 className="mt-2">Where do you want to go?</h1>
          <p>
            Choose your pickup and destination. A driver chooses your request.
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
      <section className="panel create-panel mb-5">
        <h2 className="section-title">Request a journey</h2>
        <p className="section-subtitle">
          Your request is shared with approved drivers. Choose cash or QR to pay
          your driver directly.
        </p>
        <form className="create-form" onSubmit={create}>
          <label className="field">
            PICK-UP
            <select
              className="input"
              required
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            >
              {ZONES.map((z) => (
                <option key={z}>{z}</option>
              ))}
            </select>
          </label>
          <label className="field">
            DESTINATION
            <select
              className="input"
              required
              value={to}
              onChange={(e) => setTo(e.target.value)}
            >
              {ZONES.map((z) => (
                <option key={z}>{z}</option>
              ))}
            </select>
          </label>
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
          {from === to ? (
            <p className="text-xs text-rose-600 col-span-full">
              Choose different pickup and destination zones.
            </p>
          ) : null}
          <button
            className="btn btn-primary col-span-full"
            disabled={!!busy || from === to}
          >
            <Icon name="plus" size={16} />
            {busy === "create" ? "Posting..." : "Post booking request"}
          </button>
        </form>
      </section>
      <div className="section-row">
        <div>
          <h2 className="section-title">My active requests</h2>
          <p className="section-subtitle">
            Review offers and keep track of your selected driver.
          </p>
        </div>
        <button className="btn btn-secondary" onClick={() => load()}>
          Refresh
        </button>
      </div>
      {loading ? (
        <RouteLoading label="Loading your bookings…" />
      ) : bookings.length ? (
        bookings.map((b) => {
          const future = new Date(b.departure_at).getTime() > Date.now();
          const live =
            b.ride_id == null || ["open", "full"].includes(b.ride_status ?? "");
          return (
            <article className="panel booking-item" key={b.id}>
              <div>
                <h3>
                  {b.from_zone} to {b.to_zone}
                </h3>
                <p className="text-xs muted mt-2">
                  {rideDate(b.departure_at)} at {rideTime(b.departure_at)} -{" "}
                  {b.payment_method.toUpperCase()}
                </p>
                <div className="mt-2">
                  <StatusBadge status={b.status} />
                </div>
                <p className="text-xs mt-2">
                  {b.driver_name
                    ? "Driver: " + b.driver_name
                    : "Waiting for a driver to choose your request."}
                </p>
                {b.driver_phone ? (
                  <a
                    className="text-xs text-lilac-deep"
                    href={"tel:" + b.driver_phone}
                  >
                    {b.driver_phone}
                  </a>
                ) : null}
                {b.status === "accepted" ? (
                  <p className="text-xs mt-2">
                    Agreed fare: RM {(Number(b.quoted_price) / 100).toFixed(2)}
                  </p>
                ) : null}
                {!future && b.status !== "accepted" ? (
                  <p className="text-xs muted mt-2">
                    The requested departure time has passed. Post a new request
                    for a later time.
                  </p>
                ) : null}
              </div>
              <div>
                {b.status === "offered" && future && live ? (
                  <BookingOffer
                    id={b.id}
                    price={b.quoted_price!}
                    driverId={b.driver_id}
                    onUpdated={load}
                    disabled={!!busy}
                  />
                ) : null}
                {future && live ? (
                  <button
                    className="btn btn-secondary mt-3"
                    disabled={!!busy}
                    onClick={() => {
                      setMessage("");
                      setError(false);
                      setCancel(b.id);
                    }}
                  >
                    Cancel request
                  </button>
                ) : null}
              </div>
            </article>
          );
        })
      ) : (
        <div className="panel">
          <Empty
            title="Your next journey starts here."
            text="Choose where you want to go and post your first booking request."
            icon="car"
          />
        </div>
      )}
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
