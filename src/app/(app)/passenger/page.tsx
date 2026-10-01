"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { RideCard } from "@/components/RideCard";
import { CampusScene } from "@/components/CampusScene";
import { Icon } from "@/components/Icon";
import { Notice, Stats, Empty } from "@/components/UI";
import { ZONES } from "@/lib/zones";
import { api } from "@/lib/client";
import type { RideRecord } from "@/lib/types";
type Ride = RideRecord & { booking_status?: string | null };
export default function Passenger() {
  const [rides, setRides] = useState<Ride[]>([]),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [date, setDate] = useState(""),
    [filters, setFilters] = useState(""),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [counts, setCounts] = useState({ pendingRequests: 0, acceptedBookings: 0 });
  const load = useCallback(async () => {
    try {
      const [r, n] = await Promise.all([
        api<{ rides: Ride[] }>(`/api/rides?${filters}`),
        api<typeof counts>("/api/notifications"),
      ]);
      setRides(r.rides);
      setCounts(n);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [filters]);
  useEffect(() => {
    load();
    const id = setInterval(load, 20000);
    return () => clearInterval(id);
  }, [load]);
  return (
    <div>
      <div className="page-heading">
        <div>
          <span className="eyebrow">YOUR EVERYDAY, MADE EASIER</span>
          <h1 className="mt-2">Where are we heading?</h1>
          <p>A seat, a new friend, and a little less on petrol.</p>
        </div>
      </div>
      <section className="hero-card">
        <div>
          <span className="eyebrow">GOOD RIDES. GREAT COMPANY.</span>
          <h2>
            Same campus.
            <br />
            Let’s share the journey.
          </h2>
          <p>
            Ride with verified students at fair, fixed petrol-sharing rates. No
            surprises along the way.
          </p>
          <div className="hero-pills">
            <span>
              <Icon name="shield" size={12} /> Student verified
            </span>
            <span>
              <Icon name="wallet" size={12} /> From RM 3 / ride
            </span>
            <span>
              <Icon name="leaf" size={12} /> Share & save
            </span>
          </div>
        </div>
        <CampusScene />
      </section>
      <Stats
        items={[
          { label: "Upcoming rides", value: rides.length, icon: "car" },
          {
            label: "Confirmed bookings",
            value: counts.acceptedBookings,
            icon: "check",
          },
          {
            label: "Awaiting confirmation",
            value: counts.pendingRequests,
            icon: "clock",
          },
        ]}
      />
      <form
        className="panel filter-panel"
        onSubmit={(e) => {
          e.preventDefault();
          setLoading(true);
          const q = new URLSearchParams();
          if (from) q.set("from", from);
          if (to) q.set("to", to);
          if (date) q.set("date", date);
          if (q.toString() === filters) load();
          else setFilters(q.toString());
        }}
      >
        <label className="field">
          PICK-UP
          <select
            className="input"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          >
            <option value="">Anywhere on campus</option>
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
            <option value="">Where to?</option>
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
          Find rides
        </button>
      </form>
      <div className="section-row">
        <div>
          <h2 className="section-title">
            Available rides{" "}
            <span className="ml-2 text-[11px] text-[#aa93bd]">
              {rides.length.toString().padStart(2, "0")}
            </span>
          </h2>
          <p className="section-subtitle">
            A little closer to where you need to be.
          </p>
        </div>
        <button
          className="text-[10px] text-lilac-deep"
          onClick={() => {
            setFrom("");
            setTo("");
            setDate("");
            setFilters("");
            load();
          }}
        >
          Reset filters ↺
        </button>
      </div>
      <Notice message={error} error />
      {loading ? (
        <div className="rides-grid">
          {[1, 2, 3].map((i) => (
            <div className="skeleton" key={i} />
          ))}
        </div>
      ) : rides.length ? (
        <div className="rides-grid stagger">
          {rides.map((r) => (
            <RideCard key={r.id} ride={r} onBooked={load} />
          ))}
        </div>
      ) : (
        <div className="panel">
          <Empty
            title="Your next ride is on its way."
            text="No upcoming rides match your search. Try another route or check back soon."
          />
        </div>
      )}
      <p className="mt-5 text-[10px] muted text-center">
        Payment is made directly to your driver after confirmation.{" "}
        <Link href="/history" className="text-lilac-deep">
          View my bookings →
        </Link>
      </p>
    </div>
  );
}
