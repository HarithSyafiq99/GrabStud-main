import type { BookingRecord } from "@/lib/types";
import { rideDate, rideTime } from "@/lib/client";
import { Icon } from "./Icon";
import { RouteLoading } from "./RouteLoading";
import { Empty } from "./UI";

const STEPS = ["Request sent", "Driver offer", "Booked"];

export function CurrentBookings({
  bookings,
  loading,
  disabled,
  onRefresh,
}: {
  bookings: BookingRecord[];
  loading: boolean;
  disabled: boolean;
  onRefresh: () => void | Promise<void>;
}) {
  return (
    <section
      className="panel current-bookings"
      aria-labelledby="current-bookings-title"
    >
      <div className="current-bookings-heading">
        <div>
          <h2 id="current-bookings-title" className="section-title">
            Current bookings{" "}
            <span className="current-bookings-count">{bookings.length}</span>
          </h2>
          <p className="section-subtitle">
            Follow your request from posting to booking.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={loading || disabled}
          onClick={() => void onRefresh()}
        >
          Refresh
        </button>
      </div>
      {loading ? (
        <RouteLoading label="Loading your current bookings…" />
      ) : bookings.length ? (
        <ul className="current-bookings-list">
          {bookings.map((booking) => {
            const step =
              booking.status === "accepted"
                ? 2
                : booking.status === "offered"
                  ? 1
                  : 0;
            const expired =
              booking.status !== "accepted" &&
              new Date(booking.departure_at).getTime() <= Date.now();
            const unavailable =
              booking.ride_id !== null &&
              !["open", "full"].includes(booking.ride_status ?? "");
            const inactive = expired || unavailable;
            const title = inactive
              ? "Request no longer available"
              : step === 2
                ? "Booked"
                : step === 1
                  ? "Review price"
                  : "Waiting for driver";
            const message = expired
              ? "Your departure time has passed. Post a new request."
              : unavailable
                ? "This journey is no longer open. Check your booking details."
                : step === 2
                  ? booking.arrived_at
                    ? booking.arrival_acknowledged_at
                      ? "Your driver knows you’re on your way."
                      : "Your driver has arrived at your pickup location."
                    : "Your booking is confirmed. Watch for your driver’s arrival reminder."
                  : step === 1
                    ? `${booking.driver_name || "A driver"} offered RM ${(Number(booking.quoted_price) / 100).toFixed(2)}. Review the price to confirm your booking.`
                    : "Your request is visible to drivers. Waiting for a driver to choose your journey.";
            return (
              <li key={booking.id} className="current-booking-card">
                <h3>
                  {booking.from_zone} <Icon name="arrow" size={14} />{" "}
                  {booking.to_zone}
                </h3>
                <p className="current-booking-time">
                  <Icon name="clock" size={13} />{" "}
                  {rideDate(booking.departure_at)} ·{" "}
                  {rideTime(booking.departure_at)}
                </p>
                <div
                  key={`${booking.status}-${booking.arrived_at}-${booking.arrival_acknowledged_at}-${inactive}`}
                  className="current-booking-update"
                >
                  <span
                    className="current-booking-status"
                    data-state={inactive ? "inactive" : booking.status}
                  >
                    <Icon
                      name={
                        inactive
                          ? "clock"
                          : step === 2
                            ? "check"
                            : step === 1
                              ? "wallet"
                              : "search"
                      }
                      size={14}
                    />{" "}
                    {title}
                  </span>
                  <p className="current-booking-message">{message}</p>
                  <ol
                    className="current-booking-steps"
                    aria-label="Booking progress"
                  >
                    {STEPS.map((label, index) => (
                      <li
                        key={label}
                        data-state={
                          inactive
                            ? "inactive"
                            : index < step
                              ? "done"
                              : index === step
                                ? "current"
                                : "next"
                        }
                        aria-current={
                          !inactive && index === step ? "step" : undefined
                        }
                      >
                        <span>
                          {index < step || (!inactive && step === 2) ? (
                            <Icon name="check" size={12} />
                          ) : (
                            index + 1
                          )}
                        </span>
                        {label}
                      </li>
                    ))}
                  </ol>
                </div>
                <a
                  className="current-booking-details"
                  href={`#booking-${booking.id}`}
                >
                  {step === 1 && !inactive
                    ? "Review driver’s offer"
                    : "View booking details"}{" "}
                  <Icon name="chevron" size={14} />
                </a>
              </li>
            );
          })}
        </ul>
      ) : (
        <Empty
          title="No current bookings"
          text="Post a journey request to follow its progress here."
          icon="clock"
        />
      )}
      <p className="current-bookings-hint">
        <Icon name="clock" size={12} /> Updates automatically every 20 seconds.
      </p>
    </section>
  );
}
