"use client";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import { Icon } from "@/components/Icon";
import { Notice, Stats, Empty } from "@/components/UI";
import { ZONES, getFlatRate } from "@/lib/zones";
import { api, localDateTime, rideDate, rideTime } from "@/lib/client";
import type { BookingRecord, RideRecord } from "@/lib/types";
export default function Driver() {
  const [from, setFrom] = useState<string>(ZONES[0]),
    [to, setTo] = useState<string>(ZONES[7]),
    [departure, setDeparture] = useState(""),
    [seats, setSeats] = useState(2),
    [rides, setRides] = useState<RideRecord[]>([]),
    [bookings, setBookings] = useState<BookingRecord[]>([]),
    [message, setMessage] = useState(""),
    [error, setError] = useState(false),
    [busy, setBusy] = useState(""),
    [loading, setLoading] = useState(true),
    [confirm, setConfirm] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      const [r, b] = await Promise.all([
        api<{ rides: RideRecord[] }>("/api/rides?mine=1"),
        api<{ bookings: BookingRecord[] }>("/api/bookings"),
      ]);
      setRides(r.rides);
      setBookings(b.bookings);
    } catch (e) {
      setMessage((e as Error).message);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
    const id = setInterval(load, 20000);
    return () => clearInterval(id);
  }, [load]);
  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy("create");
    setMessage("");
    try {
      await api("/api/rides", {
        method: "POST",
        body: JSON.stringify({
          from_zone: from,
          to_zone: to,
          departure_at: departure ? `${departure}:00+08:00` : "",
          seats_total: seats,
        }),
      });
      setMessage("Your ride is live. Let’s get campus moving!");
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
  async function action(kind: "booking" | "ride", id: string, action: string) {
    setBusy(id);
    try {
      await api(`/api/${kind === "booking" ? "bookings" : "rides"}/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ action }),
      });
      setMessage(
        action === "accept"
          ? "Seat confirmed. The passenger can now see your acceptance."
          : `Successfully ${action === "complete" ? "completed" : action === "cancel" ? "cancelled" : "rejected"}.`,
      );
      setError(false);
      setConfirm(null);
      await load();
    } catch (e) {
      setMessage((e as Error).message);
      setError(true);
    } finally {
      setBusy("");
    }
  }
  const active = rides.filter((r) => ["open", "full"].includes(r.status));
  return (
    <div>
      <div className="page-heading">
        <div>
          <span className="eyebrow">MAKE ROOM FOR GOOD COMPANY</span>
          <h1 className="mt-2">Your driver hub.</h1>
          <p>Going somewhere? Take your campus community with you.</p>
        </div>
        <span className="status bg-emerald-50 text-emerald-700">
          Verified driver
        </span>
      </div>
      <Stats
        items={[
          { label: "Active rides", value: active.length, icon: "car" },
          {
            label: "Requests to review",
            value: bookings.length,
            icon: "users",
          },
          {
            label: "Completed rides",
            value: rides.filter((r) => r.status === "completed").length,
            icon: "check",
          },
        ]}
      />
      <Notice message={message} error={error} />
      <div className="driver-layout">
        <section className="panel create-panel">
          <h2 className="section-title">Let’s post a ride.</h2>
          <p className="section-subtitle">
            Pick a route. We’ll take care of the fair price.
          </p>
          <form className="create-form" onSubmit={create}>
            <label className="field">
              PICK-UP
              <select
                className="input"
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
                value={to}
                onChange={(e) => setTo(e.target.value)}
              >
                {ZONES.map((z) => (
                  <option key={z}>{z}</option>
                ))}
              </select>
            </label>
            <label className="field">
              DATE & TIME · MALAYSIA
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
              AVAILABLE SEATS
              <select
                className="input"
                value={seats}
                onChange={(e) => setSeats(Number(e.target.value))}
              >
                {[1, 2, 3, 4].map((n) => (
                  <option key={n} value={n}>
                    {n} passenger{n > 1 ? "s" : ""}
                  </option>
                ))}
              </select>
            </label>
            <div className="rate-preview">
              <div>
                <p>One fair, fixed rate.</p>
                <small>Per passenger · Cash or QR paid offline</small>
              </div>
              <strong>RM {getFlatRate(from, to).toFixed(2)}</strong>
            </div>
            <button
              disabled={!!busy || from === to}
              className="btn btn-primary col-span-full"
            >
              <Icon name="plus" size={16} />
              {busy === "create" ? "Publishing…" : "Publish ride"}
            </button>
            {from === to ? (
              <p className="text-xs text-rose-600 col-span-full">
                Please choose different pick-up and destination zones.
              </p>
            ) : null}
          </form>
        </section>
        <aside className="panel help-panel">
          <Icon name="heart" size={26} className="text-[#ae93c9]" />
          <h3>Be someone’s good ride.</h3>
          <p className="section-subtitle leading-6">
            A few simple steps to a smoother shared journey.
          </p>
          <ul>
            <li>
              <span className="number">1</span>Post your route and departure
              time.
            </li>
            <li>
              <span className="number">2</span>Accept requests to confirm their
              seats.
            </li>
            <li>
              <span className="number">3</span>Meet at pick-up. Collect cash or
              QR payment directly.
            </li>
            <li>
              <span className="number">4</span>Mark the ride complete after the
              journey.
            </li>
          </ul>
        </aside>
      </div>
      <div className="section-row">
        <div>
          <h2 className="section-title">
            Booking requests{" "}
            <span className="text-xs muted ml-2">{bookings.length}</span>
          </h2>
          <p className="section-subtitle">
            Someone’s counting on your next journey.
          </p>
        </div>
        <button className="text-xs text-lilac-deep" onClick={load}>
          Refresh ↺
        </button>
      </div>
      {loading ? (
        <div className="skeleton" />
      ) : bookings.length ? (
        bookings.map((b) => (
          <article className="panel booking-item" key={b.id}>
            <div className="booking-info">
              <span className="avatar">{b.passenger_name?.[0]}</span>
              <div>
                <h3>{b.passenger_name}</h3>
                <p>
                  {b.passenger_student_number} · {b.passenger_email}
                  <br />
                  {b.from_zone} → {b.to_zone}
                  <br />
                  {rideDate(b.departure_at!)} · {rideTime(b.departure_at!)} · RM{" "}
                  {b.flat_rate} · {b.payment_method.toUpperCase()}
                </p>
              </div>
            </div>
            <div className="action-group">
              <button
                className="btn btn-success"
                disabled={!!busy}
                onClick={() => action("booking", b.id, "accept")}
              >
                <Icon name="check" size={13} />
                Accept
              </button>
              <button
                className="btn btn-secondary"
                disabled={!!busy}
                onClick={() => action("booking", b.id, "reject")}
              >
                Reject
              </button>
            </div>
          </article>
        ))
      ) : (
        <div className="panel">
          <Empty
            title="All caught up."
            text="New booking requests will appear here."
            icon="check"
          />
        </div>
      )}
      <div className="section-row">
        <div>
          <h2 className="section-title">My rides</h2>
          <p className="section-subtitle">
            Your routes, from upcoming to completed.
          </p>
        </div>
      </div>
      {rides.length ? (
        rides
          .slice()
          .reverse()
          .map((r) => (
            <article className="panel my-ride" key={r.id}>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-semibold">
                    {r.from_zone} → {r.to_zone}
                  </h3>
                  <StatusBadge status={r.status} />
                </div>
                <p className="text-[10px] muted mt-2">
                  {rideDate(r.departure_at)} · {rideTime(r.departure_at)} ·{" "}
                  {r.seats_available}/{r.seats_total} seats free · RM{" "}
                  {r.flat_rate} per passenger
                </p>
              </div>
              {["open", "full"].includes(r.status) ? (
                <div className="action-group">
                  <button
                    className="btn btn-soft"
                    disabled={
                      !!busy || new Date(r.departure_at).getTime() > Date.now()
                    }
                    title="Available after departure time"
                    onClick={() => action("ride", r.id, "complete")}
                  >
                    Complete ride
                  </button>
                  <button
                    className="btn btn-secondary"
                    disabled={!!busy}
                    onClick={() => setConfirm(r.id)}
                  >
                    Cancel
                  </button>
                </div>
              ) : null}
            </article>
          ))
      ) : (
        <div className="panel">
          <Empty
            title="Your first ride starts here."
            text="Publish a route above and make room for your fellow students."
          />
        </div>
      )}
      {confirm ? (
        <div className="modal-backdrop" onClick={() => setConfirm(null)}>
          <div
            className="modal-box max-w-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="cancel-title" className="section-title">
              Cancel this ride?
            </h2>
            <p className="text-xs muted leading-6 my-4">
              All pending and accepted bookings for this ride will be cancelled
              too.
            </p>
            <div className="action-group justify-end">
              <button
                className="btn btn-secondary"
                onClick={() => setConfirm(null)}
              >
                Keep ride
              </button>
              <button
                className="btn btn-danger"
                disabled={!!busy}
                onClick={() => action("ride", confirm, "cancel")}
              >
                Cancel ride
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
