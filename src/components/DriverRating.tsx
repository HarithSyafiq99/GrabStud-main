"use client";
import { useId, useState, type FormEvent } from "react";
import type { BookingRecord } from "@/lib/types";
import { api } from "@/lib/client";
import { Modal } from "./Modal";
import { Icon } from "./Icon";
import { Notice } from "./UI";

export function DriverRating({
  booking,
  onUpdated,
  disabled = false,
}: {
  booking: BookingRecord;
  onUpdated: () => void | Promise<void>;
  disabled?: boolean;
}) {
  const group = useId();
  const [open, setOpen] = useState(false),
    [score, setScore] = useState(0),
    [hover, setHover] = useState(0),
    [feedback, setFeedback] = useState(""),
    [finished, setFinished] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const completed = booking.status === "completed";
  const eligible =
    completed ||
    (booking.status === "accepted" &&
      !!booking.arrived_at &&
      new Date(booking.departure_at).getTime() <= Date.now() &&
      (booking.ride_id == null ||
        ["open", "full"].includes(booking.ride_status ?? "")));
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || !score || (!completed && !finished)) return;
    setBusy(true);
    setError("");
    try {
      await api(`/api/bookings/${booking.id}/rating`, {
        method: "POST",
        loadingLabel: "Saving your driver rating…",
        body: JSON.stringify({ score, feedback, confirm_finished: finished }),
      });
      setOpen(false);
      await onUpdated();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (booking.rated_at)
    return (
      <div className="ride-rating-saved" role="status">
        <Icon name="star" size={18} />
        <div>
          <strong>Your rating: {booking.rating_score}/5</strong>
          <p>
            {booking.rating_feedback || "Thank you for rating your driver."}
          </p>
        </div>
      </div>
    );
  if (!eligible || !booking.driver_id) return null;
  return (
    <>
      <button
        type="button"
        className="btn btn-secondary mt-3"
        data-action="rate-driver"
        disabled={disabled}
        onClick={() => {
          setError("");
          setOpen(true);
        }}
      >
        <Icon name="star" size={17} />
        Rate your driver
      </button>
      <Modal
        open={open}
        title="How was your journey?"
        onClose={() => {
          if (!busy) setOpen(false);
        }}
        className="rating-modal"
      >
        <p className="text-sm muted">
          Rate your ride with {booking.driver_name || "your driver"}.
        </p>
        <form onSubmit={submit}>
          <fieldset
            className="rating-stars"
            disabled={busy}
            onMouseLeave={() => setHover(0)}
          >
            <legend>Choose 1–5 stars</legend>
            {[1, 2, 3, 4, 5].map((value) => (
              <label
                key={value}
                className="rating-star"
                data-selected={value <= (hover || score)}
                onMouseEnter={() => setHover(value)}
              >
                <input
                  type="radio"
                  name={group}
                  value={value}
                  checked={score === value}
                  onChange={() => setScore(value)}
                  onFocus={() => setHover(0)}
                  required
                  aria-label={`${value} ${value === 1 ? "star" : "stars"}`}
                />
                <Icon name="star" size={30} />
              </label>
            ))}
          </fieldset>
          <p className="rating-label" aria-live="polite">
            {
              [
                "Select your rating",
                "Poor",
                "Fair",
                "Good",
                "Very good",
                "Excellent",
              ][score]
            }
          </p>
          <label className="field mt-4">
            Feedback (optional)
            <textarea
              className="input"
              rows={3}
              maxLength={500}
              value={feedback}
              disabled={busy}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="What went well? What could be better?"
            />
            <small className="muted normal-case">
              Your driver can read your feedback. {feedback.length}/500
            </small>
          </label>
          {!completed ? (
            <label className="rating-finished">
              <input
                type="checkbox"
                required
                checked={finished}
                disabled={busy}
                onChange={(e) => setFinished(e.target.checked)}
              />
              <span>
                My ride has finished. Submitting this rating marks the journey
                as completed.
              </span>
            </label>
          ) : null}
          <Notice message={error} error />
          <div className="action-group mt-4">
            <button
              className="btn btn-primary"
              disabled={busy || !score || (!completed && !finished)}
            >
              {busy ? "Saving…" : "Submit rating"}
              <Icon name="check" size={16} />
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              Later
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
