/* eslint-disable @next/next/no-img-element -- Private base64 document previews are intentionally not sent through an image proxy. */
"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import { Icon } from "@/components/Icon";
import { Avatar } from "@/components/Avatar";
import { AdminUserEditor } from "@/components/AdminUserEditor";
import { Modal } from "@/components/Modal";
import { ActionButton, ACTION_SUCCESS_MS } from "@/components/ActionButton";
import { BookingProgress } from "@/components/BookingProgress";
import { RouteLoading } from "@/components/RouteLoading";
import { Notice, Stats, Empty } from "@/components/UI";
import { api } from "@/lib/client";
import type { UserRecord } from "@/lib/types";
export default function Admin() {
  const [tab, setTab] = useState("all"),
    [editing, setEditing] = useState<UserRecord | null>(null),
    [rejecting, setRejecting] = useState<UserRecord | null>(null),
    [reason, setReason] = useState(""),
    [reviewError, setReviewError] = useState(""),
    [users, setUsers] = useState<UserRecord[]>([]),
    [counts, setCounts] = useState<Record<string, number>>({}),
    [query, setQuery] = useState(""),
    [preview, setPreview] = useState<{ url: string; title: string } | null>(
      null,
    ),
    [message, setMessage] = useState(""),
    [error, setError] = useState(false),
    [busy, setBusy] = useState(""),
    [busyAction, setBusyAction] = useState(""),
    [successful, setSuccessful] = useState(""),
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
    if (busy) return;
    setBusy(userId);
    setBusyAction(action);
    try {
      await api("/api/admin/users", {
        method: "PATCH",
        body: JSON.stringify({
          userId,
          action,
          expectedUpdatedAt: users.find((u) => u.id === userId)?.updated_at,
          ...(action === "reject" ? { rejection_reason: reason.trim() } : {}),
        }),
      });
      setMessage(
        action === "approve"
          ? "Student approved. Their campus journey can begin."
          : "Application declined. The student can submit updated documents.",
      );
      setError(false);
      if (action === "reject") setRejecting(null);
      if (action === "approve") {
        setSuccessful(userId);
        await new Promise((resolve) => setTimeout(resolve, ACTION_SUCCESS_MS));
      }
      await load();
    } catch (e) {
      if (action === "reject") setReviewError((e as Error).message);
      setMessage((e as Error).message);
      setError(true);
    } finally {
      setBusy("");
      setBusyAction("");
      setSuccessful("");
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
    `${u.name} ${u.email} ${u.phone_number} ${u.student_number}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <div>
      <BookingProgress
        active={!!busy}
        success={!!successful}
        label={
          successful
            ? "Student approved!"
            : busyAction === "approve"
              ? "Approving this student…"
              : "Updating this application…"
        }
      />
      <div className="page-heading">
        <div>
          <span className="eyebrow">A COMMUNITY BUILT ON TRUST</span>
          <h1 className="mt-2">Keep campus connected.</h1>
          <p>
            Manage user accounts, edit details and review student documents.
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
          {["all", "pending", "approved", "rejected"].map((t) => (
            <button
              className={tab === t ? "active" : ""}
              aria-pressed={tab === t}
              onClick={() => setTab(t)}
              key={t}
            >
              <span className="capitalize">
                {t === "all" ? "All users" : t}
              </span>
              <span className="text-[9px]">{counts[t] ?? 0}</span>
            </button>
          ))}
        </div>
        <input
          className="input"
          aria-label="Search users"
          placeholder="Search name, email or student number…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="panel table-panel">
        <table className="data-table mobile-card-table">
          <thead>
            <tr>
              <th>USER</th>
              <th>ROLE</th>
              <th>STUDENT ID</th>
              <th>LICENSE</th>
              <th>STATUS</th>
              <th>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {!loading &&
              filtered.map((u) => (
                <tr key={u.id}>
                  <td data-label="Student" className="mobile-card-title">
                    <div className="flex gap-3 items-center">
                      {u.profile_photo ? (
                        <button
                          className="review-photo"
                          aria-label={`View ${u.name}'s profile photo`}
                          onClick={() =>
                            setPreview({
                              url: u.profile_photo!,
                              title: `${u.name} · Profile photo`,
                            })
                          }
                        >
                          <Avatar name={u.name} photo={u.profile_photo} />
                        </button>
                      ) : (
                        <Avatar name={u.name} />
                      )}
                      <div>
                        <p>{u.name}</p>
                        <small>
                          {u.student_number} · {u.email}
                          <br />
                          {u.phone_number || "Phone number not added"}
                          {u.role === "driver" ? (
                            <>
                              <br />
                              {u.car_colour} · {u.car_type} ·{" "}
                              {u.car_plate || "Car details not added"}
                            </>
                          ) : null}
                        </small>
                      </div>
                    </div>
                  </td>
                  <td data-label="Role" className="capitalize muted">
                    {u.role}
                  </td>
                  <td data-label="Student ID">
                    {doc(u.student_id_doc, `${u.name} · Student ID`)}
                  </td>
                  <td data-label="License">
                    {doc(u.license_doc, `${u.name} · Driving license`)}
                  </td>
                  <td data-label="Status">
                    <StatusBadge status={u.status} />
                  </td>
                  <td data-label="Actions" className="mobile-card-actions">
                    <div className="admin-user-actions">
                      <button
                        type="button"
                        className="btn btn-secondary"
                        disabled={!!busy}
                        onClick={() => setEditing(u)}
                        aria-label={`Edit ${u.name}`}
                      >
                        <Icon name="edit" size={15} />
                        Edit user
                      </button>
                      {u.status === "pending" && u.role !== "admin" ? (
                        <div className="action-group">
                          <ActionButton
                            loadingLabel="Approving…"
                            successLabel="Approved!"
                            pending={busy === u.id && busyAction === "approve"}
                            success={successful === u.id}
                            disabled={!!busy}
                            onClick={() => act(u.id, "approve")}
                          >
                            Approve
                          </ActionButton>
                          <button
                            className="btn btn-secondary"
                            disabled={!!busy}
                            onClick={() => {
                              setRejecting(u);
                              setReason("");
                              setReviewError("");
                            }}
                          >
                            {busy === u.id && busyAction === "reject"
                              ? "Declining…"
                              : "Decline"}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
        {loading ? (
          <RouteLoading label="Loading user accounts…" />
        ) : !filtered.length ? (
          <Empty
            title="All clear here."
            text="No users match this view."
            icon="shield"
          />
        ) : null}
      </div>
      <p className="text-[10px] muted mt-4">
        Drivers require both a Student ID and a driving license. Review each
        document and check that profile photos show a clear, centred face against
        a plain light background before approving.
      </p>
      {editing ? (
        <AdminUserEditor
          key={editing.id}
          user={editing}
          onClose={() => setEditing(null)}
          onRemoved={async (name) => {
            setEditing(null);
            setMessage(`${name}’s account was removed.`);
            setError(false);
            await load();
          }}
          onSaved={async (name) => {
            setMessage(`${name}’s account was updated.`);
            setError(false);
            await load();
          }}
        />
      ) : null}
      {rejecting ? (
        <Modal
          open
          title="Decline application"
          onClose={() => {
            if (!busy) setRejecting(null);
          }}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (reason.trim()) void act(rejecting.id, "reject");
            }}
          >
            <p className="text-sm muted mb-4">
              Explain what {rejecting.name} needs to correct. This message will
              appear on their registration status screen.
            </p>
            <label className="field">
              Rejection reason
              <textarea
                className="input"
                required
                maxLength={1000}
                rows={4}
                value={reason}
                disabled={!!busy}
                onChange={(event) => setReason(event.target.value)}
                placeholder="e.g. Your Student ID is blurred. Upload a clear photo with your name and student number visible."
              />
            </label>
            <p className="text-xs muted mt-2">
              {reason.length}/1000 characters
            </p>
            <Notice message={reviewError} error />
            <div className="action-group mt-4">
              <button
                className="btn btn-danger"
                disabled={!!busy || !reason.trim()}
              >
                {busy ? "Declining…" : "Decline & notify user"}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={!!busy}
                onClick={() => setRejecting(null)}
              >
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
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
