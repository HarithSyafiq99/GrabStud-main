/* eslint-disable @next/next/no-img-element -- Private base64 document previews are intentionally not sent through an image proxy. */
"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import { Icon } from "@/components/Icon";
import { Notice, Stats, Empty } from "@/components/UI";
import { api } from "@/lib/client";
import type { UserRecord } from "@/lib/types";
export default function Admin() {
  const [tab, setTab] = useState("pending"),
    [users, setUsers] = useState<UserRecord[]>([]),
    [counts, setCounts] = useState<Record<string, number>>({}),
    [query, setQuery] = useState(""),
    [preview, setPreview] = useState<{ url: string; title: string } | null>(
      null,
    ),
    [message, setMessage] = useState(""),
    [error, setError] = useState(false),
    [busy, setBusy] = useState(""),
    [loading, setLoading] = useState(true);
  const closeRef = useRef<HTMLButtonElement>(null);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [u, o] = await Promise.all([
        api<{ users: UserRecord[] }>(`/api/admin/users?tab=${tab}`),
        api<{ counts: Record<string, number> }>("/api/admin/overview"),
      ]);
      setUsers(u.users);
      setCounts(o.counts);
    } catch (e) {
      setMessage((e as Error).message);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [tab]);
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    if (!preview) return;
    closeRef.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPreview(null);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [preview]);
  async function act(userId: string, action: string) {
    setBusy(userId);
    try {
      await api("/api/admin/users", {
        method: "PATCH",
        body: JSON.stringify({ userId, action }),
      });
      setMessage(
        action === "approve"
          ? "Student approved. Their campus journey can begin."
          : "Application declined. The student can submit updated documents.",
      );
      setError(false);
      await load();
    } catch (e) {
      setMessage((e as Error).message);
      setError(true);
    } finally {
      setBusy("");
    }
  }
  function doc(url: string | null, title: string) {
    return url ? (
      <button className="doc-button" onClick={() => setPreview({ url, title })}>
        {url.startsWith("data:image/") ? (
          <img src={url} alt={title} />
        ) : (
          <Icon name="file" size={15} />
        )}
        View
      </button>
    ) : (
      <span className="muted">—</span>
    );
  }
  const filtered = users.filter((u) =>
    `${u.name} ${u.email} ${u.student_number}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <div>
      <div className="page-heading">
        <div>
          <span className="eyebrow">A COMMUNITY BUILT ON TRUST</span>
          <h1 className="mt-2">Keep campus connected.</h1>
          <p>
            Review documents and welcome verified students to the community.
          </p>
        </div>
        <button className="btn btn-secondary" onClick={load}>
          <Icon name="history" size={15} />
          Refresh
        </button>
      </div>
      <Stats
        items={[
          {
            label: "Awaiting review",
            value: counts.pending ?? 0,
            icon: "clock",
          },
          {
            label: "Verified students",
            value: counts.approved ?? 0,
            icon: "shield",
          },
          {
            label: "Declined applications",
            value: counts.rejected ?? 0,
            icon: "file",
          },
        ]}
      />
      <Notice message={message} error={error} />
      <div className="table-tools">
        <div className="tabs">
          {["pending", "approved", "rejected"].map((t) => (
            <button
              className={tab === t ? "active" : ""}
              aria-pressed={tab === t}
              onClick={() => setTab(t)}
              key={t}
            >
              <span className="capitalize">{t}</span>
              <span className="text-[9px]">{counts[t] ?? 0}</span>
            </button>
          ))}
        </div>
        <input
          className="input"
          aria-label="Search students"
          placeholder="Search name, email or student number…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="panel table-panel">
        <table className="data-table">
          <thead>
            <tr>
              <th>STUDENT</th>
              <th>ROLE</th>
              <th>STUDENT ID</th>
              <th>LICENSE</th>
              <th>STATUS</th>
              <th>REVIEW</th>
            </tr>
          </thead>
          <tbody>
            {!loading &&
              filtered.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className="flex gap-3 items-center">
                      <span className="avatar">{u.name[0]}</span>
                      <div>
                        <p>{u.name}</p>
                        <small>
                          {u.student_number} · {u.email}
                        </small>
                      </div>
                    </div>
                  </td>
                  <td className="capitalize muted">{u.role}</td>
                  <td>{doc(u.student_id_doc, `${u.name} · Student ID`)}</td>
                  <td>{doc(u.license_doc, `${u.name} · Driving license`)}</td>
                  <td>
                    <StatusBadge status={u.status} />
                  </td>
                  <td>
                    {u.status === "pending" ? (
                      <div className="action-group">
                        <button
                          className="btn btn-success"
                          disabled={!!busy}
                          onClick={() => act(u.id, "approve")}
                        >
                          <Icon name="check" size={12} />
                          Approve
                        </button>
                        <button
                          className="btn btn-secondary"
                          disabled={!!busy}
                          onClick={() => act(u.id, "reject")}
                        >
                          Decline
                        </button>
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
        {loading ? (
          <div className="skeleton m-5" />
        ) : !filtered.length ? (
          <Empty
            title="All clear here."
            text="No students match this view."
            icon="shield"
          />
        ) : null}
      </div>
      <p className="text-[10px] muted mt-4">
        Drivers require both a Student ID and a driving license. Review each
        document before approving.
      </p>
      {preview ? (
        <div className="modal-backdrop" onClick={() => setPreview(null)}>
          <div
            className="modal-box"
            role="dialog"
            aria-modal="true"
            aria-labelledby="document-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-head">
              <h2 id="document-title">{preview.title}</h2>
              <button
                ref={closeRef}
                className="icon-btn"
                onClick={() => setPreview(null)}
                aria-label="Close document preview"
              >
                <Icon name="close" />
              </button>
            </div>
            {preview.url.startsWith("data:application/pdf") ? (
              <iframe src={preview.url} title={preview.title} />
            ) : (
              <img src={preview.url} alt={preview.title} />
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
