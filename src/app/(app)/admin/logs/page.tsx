"use client";
import { useCallback, useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { Notice, Empty } from "@/components/UI";
import { api, rideDate, rideTime } from "@/lib/client";
import type { AuditLog } from "@/lib/types";
export default function Logs() {
  const [logs, setLogs] = useState<AuditLog[]>([]),
    [query, setQuery] = useState(""),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      const d = await api<{ logs: AuditLog[] }>("/api/admin/logs");
      setLogs(d.logs);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  const filtered = logs.filter((l) =>
    `${l.actor_name} ${l.action} ${l.details}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <div>
      <div className="page-heading">
        <div>
          <span className="eyebrow">A CLEARER VIEW OF CAMPUS</span>
          <h1 className="mt-2">Community activity.</h1>
          <p>An audit trail of sign-ins, approvals, rides, and bookings.</p>
        </div>
        <a className="btn btn-secondary" href="/api/reports/logs">
          <Icon name="file" size={15} />
          Export CSV
        </a>
      </div>
      <div className="table-tools">
        <input
          className="input"
          aria-label="Search system activity"
          placeholder="Search activity…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button className="btn btn-secondary" onClick={load}>
          Refresh ↺
        </button>
      </div>
      <Notice message={error} error />
      <div className="panel table-panel">
        <table className="data-table">
          <thead>
            <tr>
              <th>WHEN · MYT</th>
              <th>ACTIVITY</th>
              <th>STUDENT</th>
              <th>DETAILS</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((l) => (
              <tr key={l.id}>
                <td>
                  {rideDate(l.created_at)}
                  <small>{rideTime(l.created_at)}</small>
                </td>
                <td>
                  <span className="status bg-lilac/40 text-lilac-deep">
                    {l.action.toLowerCase().replaceAll("_", " ")}
                  </span>
                </td>
                <td>{l.actor_name ?? "System"}</td>
                <td className="whitespace-normal min-w-64 text-[#9c88b0] leading-6">
                  {l.details}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading ? (
          <div className="skeleton m-5" />
        ) : !filtered.length ? (
          <Empty
            title="Nothing to display."
            text="New platform activity will appear here."
            icon="history"
          />
        ) : null}
      </div>
    </div>
  );
}
