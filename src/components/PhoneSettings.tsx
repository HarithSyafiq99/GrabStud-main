"use client";
import { FormEvent, useState } from "react";
import { api } from "@/lib/client";
export function PhoneSettings({ initialPhone }: { initialPhone: string }) {
  const [open, setOpen] = useState(false),
    [phone, setPhone] = useState(initialPhone),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await api<{ phone_number: string }>("/api/auth/me", {
        method: "PATCH",
        body: JSON.stringify({ phone_number: phone }),
      });
      setPhone(result.phone_number);
      setMessage("Phone number saved.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button
        className="btn btn-secondary"
        onClick={() => {
          setOpen(true);
          setMessage("");
          setError("");
        }}
      >
        {phone ? "Edit phone number" : "Add phone number"}
      </button>
      {open ? (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <form
            className="modal-box max-w-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="phone-title"
            onClick={(e) => e.stopPropagation()}
            onSubmit={save}
          >
            <h2 id="phone-title" className="section-title">
              Your contact number
            </h2>
            <p className="text-xs muted my-3">
              Your driver or passenger can use this number to coordinate your
              booking.
            </p>
            <label className="field">
              Phone number
              <input
                className="input"
                type="tel"
                required
                autoComplete="tel"
                maxLength={25}
                placeholder="e.g. +60123456789"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </label>
            {error ? (
              <p role="alert" className="text-xs text-rose-600 my-3">
                {error}
              </p>
            ) : null}
            {message ? (
              <p role="status" className="text-xs text-emerald-700 my-3">
                {message}
              </p>
            ) : null}
            <div className="action-group mt-4">
              <button className="btn btn-primary" disabled={busy}>
                {busy ? "Saving..." : "Save number"}
              </button>
              <button
                className="btn btn-secondary"
                type="button"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
