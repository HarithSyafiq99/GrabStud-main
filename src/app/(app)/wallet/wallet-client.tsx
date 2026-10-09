"use client";
import { useCallback, useEffect, useState } from "react";
import { api, rideDate } from "@/lib/client";
import type { WalletData, WalletPeriod } from "@/lib/wallet";
import { Icon } from "@/components/Icon";
import { RouteLoading } from "@/components/RouteLoading";
import { Notice, Empty } from "@/components/UI";
const money = (sen: number) =>
  "RM " +
  (sen / 100).toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export function WalletClient() {
  const [data, setData] = useState<WalletData | null>(null),
    [period, setPeriod] = useState<WalletPeriod>("daily"),
    [error, setError] = useState("");
  const load = useCallback(async (background = false) => {
    try {
      setData(
        await api<WalletData>("/api/wallet", {
          feedback: background ? "background" : "blocking",
        }),
      );
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    void load();
    const refresh = () => {
      if (!document.hidden) void load(true);
    };
    const timer = setInterval(refresh, 20000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [load]);
  const current = data?.periods[period];
  return (
    <div className="wallet-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">YOUR JOURNEYS, AT A GLANCE</span>
          <h1>My wallet</h1>
          <p>A clear view of the fares from your journeys.</p>
        </div>
        <button className="btn btn-secondary" onClick={() => void load()}>
          <Icon name="history" size={16} />
          Refresh
        </button>
      </div>
      <Notice message={error} error />
      {!data && !error ? <RouteLoading label="Loading your wallet…" /> : null}
      {current && data ? (
        <>
          <div
            className="wallet-periods"
            role="group"
            aria-label="Income period"
          >
            {(["daily", "weekly", "monthly"] as const).map((item) => (
              <button
                type="button"
                key={item}
                className={period === item ? "active" : ""}
                aria-pressed={period === item}
                onClick={() => setPeriod(item)}
              >
                {item === "daily"
                  ? "Daily"
                  : item === "weekly"
                    ? "Weekly"
                    : "Monthly"}
              </button>
            ))}
          </div>
          <section className="panel wallet-summary">
            <div className="wallet-chart-section">
              <div className="section-row">
                <div>
                  <span className="eyebrow">{current.label.toUpperCase()}</span>
                  <h2 className="section-title">Fare overview</h2>
                </div>
                <span className="wallet-currency">MYR</span>
              </div>
              <div className="wallet-donut">
                <svg
                  viewBox="0 0 200 200"
                  role="img"
                  aria-label={`${current.label}: ${money(current.cash)} cash and ${money(current.qr)} QR`}
                >
                  <circle
                    cx="100"
                    cy="100"
                    r="82"
                    fill="none"
                    stroke={current.total ? "#c5b2e8" : "#eeeaf4"}
                    strokeWidth="18"
                  />
                  <circle
                    className="wallet-cash-arc"
                    cx="100"
                    cy="100"
                    r="82"
                    fill="none"
                    stroke="#7954bf"
                    strokeWidth="18"
                    pathLength="100"
                    strokeDasharray={`${current.total ? (current.cash / current.total) * 100 : 0} ${current.total ? 100 - (current.cash / current.total) * 100 : 100}`}
                    transform="rotate(-90 100 100)"
                  />
                </svg>
                <div className="wallet-donut-center" key={period}>
                  <span>Recorded fares</span>
                  <strong>{money(current.total)}</strong>
                  <small>
                    {current.journeys}{" "}
                    {current.journeys === 1 ? "journey" : "journeys"}
                  </small>
                </div>
              </div>
              <div className="wallet-legend">
                <div>
                  <span className="wallet-dot cash" />
                  <span>Cash</span>
                  <strong>{money(current.cash)}</strong>
                </div>
                <div>
                  <span className="wallet-dot qr" />
                  <span>QR payment</span>
                  <strong>{money(current.qr)}</strong>
                </div>
              </div>
            </div>
            <div className="wallet-side">
              <Icon name="wallet" size={27} />
              <h3>Every journey adds up.</h3>
              <p>See your day, week or month in one place.</p>
              <div className="wallet-mini-stats">
                {Object.entries(data.periods).map(([key, summary]) => (
                  <div key={key} data-selected={key === period}>
                    <span>{summary.label}</span>
                    <strong>{money(summary.total)}</strong>
                  </div>
                ))}
              </div>
              <p className="wallet-note">
                Fares are recorded when you tap I’ve arrived at pickup. Past
                completed journeys are also included. Cash and QR payments are
                collected directly; these totals do not confirm that payment was
                received.
              </p>
            </div>
          </section>
          <section className="panel wallet-recent">
            <div className="section-row">
              <div>
                <h2 className="section-title">Recent journey fares</h2>
                <p className="section-subtitle">
                  Your latest fares recorded at pickup.
                </p>
              </div>
            </div>
            {data.recent.length ? (
              <div className="wallet-transactions">
                {data.recent.map((item) => (
                  <article key={item.id}>
                    <span className="wallet-transaction-icon">
                      <Icon name="car" size={20} />
                    </span>
                    <div>
                      <strong>
                        {item.from_zone} → {item.to_zone}
                      </strong>
                      <p>
                        {rideDate(item.recorded_at)} ·{" "}
                        {item.payment_method === "cash" ? "Cash" : "QR payment"}
                      </p>
                    </div>
                    <strong className="wallet-amount">
                      {money(item.quoted_price)}
                    </strong>
                  </article>
                ))}
              </div>
            ) : (
              <Empty
                title="Your first journey starts the story."
                text="Tap I’ve arrived on a booked journey to record its agreed fare here."
                icon="wallet"
              />
            )}
          </section>
          <p className="text-xs muted mt-4">
            Periods follow Malaysia time (UTC+8). Weeks start on Monday.
          </p>
        </>
      ) : null}
    </div>
  );
}
