"use client";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import { Icon } from "@/components/Icon";
import { ACTION_SUCCESS_MS } from "@/components/ActionButton";
import { BookingProgress } from "@/components/BookingProgress";
import { RouteLoading } from "@/components/RouteLoading";
import { FareOfferForm } from "@/components/FareOfferForm";
import { Notice, Stats, Empty } from "@/components/UI";
import { ZONES, getFlatRate } from "@/lib/zones";
import { api, rideDate, rideTime } from "@/lib/client";
import type { BookingRecord } from "@/lib/types";
export default function Driver() {
  const [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [date, setDate] = useState(""),
    [filters, setFilters] = useState(""),
    [available, setAvailable] = useState<BookingRecord[]>([]),
    [mine, setMine] = useState<BookingRecord[]>([]),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(""),
    [busyLabel, setBusyLabel] = useState(""),
    [successful, setSuccessful] = useState(""),
    [message, setMessage] = useState(""),
    [error, setError] = useState(false),
    [cancel, setCancel] = useState<string | null>(null);
  const load = useCallback(
    async (background = false) => {
      const feedback = background ? "background" : "blocking";
      try {
        const [requests, assigned] = await Promise.all([
          api<{ bookings: BookingRecord[] }>("/api/bookings?" + filters, {
            feedback,
          }),
          api<{ bookings: BookingRecord[] }>("/api/bookings?mine=1", {
            feedback,
          }),
        ]);
        setAvailable(requests.bookings);
        setMine(assigned.bookings.filter((b) => b.status !== "pending"));
      } catch (e) {
        setMessage((e as Error).message);
        setError(true);
      } finally {
        setLoading(false);
      }
    },
    [filters],
  );
  useEffect(() => {
    load();
    const timer = setInterval(() => load(true), 20000);
    return () => clearInterval(timer);
  }, [load]);
  function filter(e: FormEvent) {
    e.preventDefault();
    const query = new URLSearchParams();
    if (from) query.set("from", from);
    if (to) query.set("to", to);
    if (date) query.set("date", date);
    if (query.toString() === filters) load();
    else {
      setLoading(true);
      setFilters(query.toString());
    }
  }
  async function action(id: string, kind: string, price?: number) {
    if (busy) return;
    if (kind === "accept" && price == null) return;
    setBusy(id);
    setBusyLabel(
      kind === "accept"
        ? "Sending your price offer…"
        : kind === "withdraw"
          ? "Withdrawing your offer…"
          : kind === "complete"
            ? "Completing this journey…"
            : "Cancelling this booking…",
    );
    setMessage("");
    try {
      await api("/api/bookings/" + id, {
        method: "PATCH",
        body: JSON.stringify({
          action: kind,
          ...(kind === "accept" ? { price } : {}),
        }),
      });
      setMessage(
        kind === "accept"
          ? "Passenger selected and price sent. Wait for their agreement."
          : kind === "withdraw"
            ? "Your offer was withdrawn. Other drivers can choose this request."
            : kind === "complete"
              ? "Journey completed."
              : "Booking cancelled.",
      );
      setError(false);
      setCancel(null);
      if (kind === "accept") {
        setSuccessful(id);
        await new Promise((resolve) => setTimeout(resolve, ACTION_SUCCESS_MS));
      }
      await load();
    } catch (e) {
      setMessage((e as Error).message);
      setError(true);
      await load();
    } finally {
      setBusy("");
      setSuccessful("");
    }
  }
  function info(b: BookingRecord) {
    return (
      <div className="booking-info">
        <span className="avatar">{b.passenger_name?.[0]}</span>
        <div>
          <h3>{b.passenger_name}</h3>
          <p className="text-xs muted">
            {b.from_zone} to <strong>{b.to_zone}</strong>
            <br />
            {rideDate(b.departure_at)} at {rideTime(b.departure_at)}
            <br />
            {b.passenger_email} - {b.payment_method.toUpperCase()}
          </p>
          {b.passenger_phone ? (
            <a
              className="text-xs text-lilac-deep"
              href={"tel:" + b.passenger_phone}
            >
              {b.passenger_phone}
            </a>
          ) : (
            <p className="text-xs muted">Phone number not added</p>
          )}
        </div>
      </div>
    );
  }
  return (
    <div>
      <BookingProgress
        active={!!busy}
        label={successful ? "Price offer sent!" : busyLabel}
        success={!!successful}
      />
      <div className="page-heading">
        <div>
          <span className="eyebrow">CHOOSE A JOURNEY TO SHARE</span>
          <h1 className="mt-2">Choose your passengers.</h1>
          <p>
            Find passenger requests going to your destination, choose who to
            take, and offer your price.
          </p>
        </div>
        <span className="status bg-emerald-50 text-emerald-700">
          Verified driver
        </span>
      </div>
      <Stats
        items={[
          {
            label: "Matching requests",
            value: available.length,
            icon: "users",
          },
          {
            label: "Awaiting passenger agreement",
            value: mine.filter((b) => b.status === "offered").length,
            icon: "clock",
          },
          {
            label: "Booked journeys",
            value: mine.filter((b) => b.status === "accepted").length,
            icon: "check",
          },
        ]}
      />
      <Notice message={message} error={error} />
      <form className="panel filter-panel" onSubmit={filter}>
        <label className="field">
          PICK-UP
          <select
            className="input"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          >
            <option value="">Any pickup</option>
            {ZONES.map((z) => (
              <option key={z}>{z}</option>
            ))}
          </select>
        </label>
        <label className="field">
          DESTINATION
          <select
            className="input"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          >
            <option value="">Any destination</option>
            {ZONES.map((z) => (
              <option key={z}>{z}</option>
            ))}
          </select>
        </label>
        <label className="field">
          DEPARTURE DATE
          <input
            className="input"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <button className="btn btn-primary">
          <Icon name="search" size={16} />
          Find passengers
        </button>
      </form>
      <div className="section-row">
        <div>
          <h2 className="section-title">Available passenger requests</h2>
          <p className="section-subtitle">
            Only choose requests you can fulfil. The passenger confirms after
            reviewing your fare.
          </p>
        </div>
        <button
          className="text-xs text-lilac-deep"
          onClick={() => {
            setFrom("");
            setTo("");
            setDate("");
            if (filters) setFilters("");
            else load();
          }}
        >
          Reset filters
        </button>
      </div>
      {loading ? (
        <RouteLoading label="Loading passenger requests…" />
      ) : available.length ? (
        available.map((b) => (
          <article className="panel booking-item" key={b.id}>
            {info(b)}
            <FareOfferForm
              passengerName={b.passenger_name ?? "passenger"}
              suggestedPrice={getFlatRate(b.from_zone, b.to_zone)}
              disabled={!!busy}
              pending={busy === b.id}
              success={successful === b.id}
              onOffer={(price) => action(b.id, "accept", price)}
            />
          </article>
        ))
      ) : (
        <div className="panel">
          <Empty
            title="No matching requests yet."
            text="Try another destination or check back for new passenger requests."
            icon="users"
          />
        </div>
      )}
      <div className="section-row">
        <div>
          <h2 className="section-title">My selected passengers</h2>
          <p className="section-subtitle">
            Your offers and confirmed bookings.
          </p>
        </div>
        <button className="btn btn-secondary" onClick={() => load()}>
          Refresh
        </button>
      </div>
      {mine.length ? (
        mine.map((b) => {
          const future = new Date(b.departure_at).getTime() > Date.now(),
            live =
              b.ride_id == null ||
              ["open", "full"].includes(b.ride_status ?? "");
          return (
            <article className="panel booking-item" key={b.id}>
              {info(b)}
              <div>
                <StatusBadge status={b.status} />
                <p className="text-xs mt-2">
                  RM {(Number(b.quoted_price) / 100).toFixed(2)}
                </p>
                {b.status === "offered" ? (
                  <p className="text-xs muted mt-2">
                    Waiting for the passenger to agree to your price.
                  </p>
                ) : null}
                <div className="action-group flex-wrap mt-3">
                  {b.status === "offered" && future && live ? (
                    <button
                      className="btn btn-secondary"
                      disabled={!!busy}
                      onClick={() => action(b.id, "withdraw")}
                    >
                      Withdraw offer
                    </button>
                  ) : null}
                  {b.status === "accepted" && live ? (
                    <>
                      <button
                        className="btn btn-success"
                        disabled={!!busy || future}
                        title="Available after the requested departure time"
                        onClick={() => action(b.id, "complete")}
                      >
                        Complete journey
                      </button>
                      {future ? (
                        <button
                          className="btn btn-secondary"
                          disabled={!!busy}
                          onClick={() => {
                            setMessage("");
                            setError(false);
                            setCancel(b.id);
                          }}
                        >
                          Cancel booking
                        </button>
                      ) : null}
                    </>
                  ) : null}
                </div>
              </div>
            </article>
          );
        })
      ) : (
        <div className="panel">
          <Empty
            title="Choose your first passenger."
            text="Select an available request above and enter the fare you want to offer."
            icon="car"
          />
        </div>
      )}
      {cancel ? (
        <div className="modal-backdrop" onClick={() => setCancel(null)}>
          <div
            className="modal-box max-w-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-driver-booking-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="cancel-driver-booking-title" className="section-title">
              Cancel this booking?
            </h2>
            <p className="text-xs muted my-4">
              The passenger&apos;s confirmed booking will be cancelled.
            </p>
            <Notice message={error ? message : ""} error />
            <div className="action-group">
              <button
                className="btn btn-secondary"
                onClick={() => setCancel(null)}
              >
                Keep booking
              </button>
              <button
                className="btn btn-danger"
                disabled={!!busy}
                onClick={() => action(cancel, "cancel")}
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
