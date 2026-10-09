"use client";
import type { BookingRecord } from "@/lib/types";
import { rideDate, rideTime } from "@/lib/client";
import { Icon } from "./Icon";
import { PassengerCount } from "./PassengerCount";
import { RouteLoading } from "./RouteLoading";
import { BookingOffer } from "./BookingOffer";
import { BookingLocations } from "./BookingLocations";
import { DriverDetails, ArrivalNotice, PickupRemark } from "./PickupDetails";
import { Empty } from "./UI";

const STEPS = ["Request sent", "Driver offer", "Booked"];

export function CurrentBookings({
  bookings,
  loading,
  disabled,
  onRefresh,
  onCancel,
}: {
  bookings: BookingRecord[];
  loading: boolean;
  disabled: boolean;
  onRefresh: () => void | Promise<void>;
  onCancel: (id: string) => void;
}) {
  return (
    <section
      className="panel current-bookings"
      aria-labelledby="current-bookings-title"
    >
      <div className="current-bookings-heading">
        <div>
          <h2 id="current-bookings-title" className="section-title">
            Current Booking{" "}
            <span className="current-bookings-count">
              {Math.min(bookings.length, 1)}
            </span>
          </h2>
          <p className="section-subtitle">
            Your latest booking. Earlier journeys and offers are in History.
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
          {bookings.slice(0, 1).map((booking) => {
            const step = ["accepted", "completed"].includes(booking.status)
              ? 2
              : booking.status === "offered"
                ? 1
                : 0;
            const expired =
              ["pending", "offered"].includes(booking.status) &&
              new Date(booking.departure_at).getTime() <= Date.now();
            const unavailable =
              booking.ride_id !== null &&
              !["open", "full"].includes(booking.ride_status ?? "");
            const closed = ["cancelled", "rejected"].includes(booking.status);
            const inactive =
              closed ||
              (booking.status !== "completed" && (expired || unavailable));
            const future =
              new Date(booking.departure_at).getTime() > Date.now();
            const active = ["pending", "offered", "accepted"].includes(
              booking.status,
            );
            const complete = !inactive && step === 2;
            const title = closed
              ? booking.status === "cancelled"
                ? "Cancelled"
                : "Rejected"
              : inactive
                ? "Request no longer available"
                : step === 2
                  ? "Complete"
                  : step === 1
                    ? "Review price"
                    : "Waiting for driver";
            const message = closed
              ? "This booking is closed. Post a new journey whenever you are ready."
              : booking.status === "completed"
                ? "Your ride is completed. Thank you for travelling with GrabStudent."
                : expired
                  ? "Your departure time has passed. Post a new request."
                  : unavailable
                    ? "This journey is no longer open. Check your booking details."
                    : step === 2
                      ? booking.arrived_at
                        ? booking.arrival_acknowledged_at
                          ? "Your driver knows you’re on your way."
                          : "Your driver has arrived at your pickup location."
                        : "Booking complete — your journey is confirmed. Watch for your driver’s arrival reminder."
                      : step === 1
                        ? `${booking.driver_name || "A driver"} offered RM ${(Number(booking.quoted_price) / 100).toFixed(2)}. Review the price to confirm your booking.`
                        : "Your request is visible to drivers. Waiting for a driver to choose your journey.";
            return (
              <li
                key={booking.id}
                className="current-booking-card"
                id={`booking-${booking.id}`}
                data-complete={complete}
              >
                <h3>
                  {booking.from_zone} <Icon name="arrow" size={14} />{" "}
                  {booking.to_zone}
                </h3>
                <p className="current-booking-time">
                  <Icon name="clock" size={13} />{" "}
                  {rideDate(booking.departure_at)} ·{" "}
                  {rideTime(booking.departure_at)}
                </p>
                <PassengerCount count={booking.passenger_count} />
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
                            : complete || index < step
                              ? "done"
                              : index === step
                                ? "current"
                                : "next"
                        }
                        aria-current={
                          !inactive && !complete && index === step
                            ? "step"
                            : undefined
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
                <div className="current-booking-content">
                  <DriverDetails booking={booking} />
                  {booking.quoted_price != null && step === 2 ? (
                    <p className="text-sm mt-3">
                      Agreed fare:{" "}
                      <strong>
                        RM {(Number(booking.quoted_price) / 100).toFixed(2)}
                      </strong>{" "}
                      · {booking.payment_method.toUpperCase()}
                    </p>
                  ) : null}
                  <ArrivalNotice booking={booking} onUpdated={onRefresh} />
                  <PickupRemark
                    booking={booking}
                    onUpdated={onRefresh}
                    editable={active}
                  />
                  <BookingLocations booking={booking} />
                  {booking.status === "offered" && future && !inactive ? (
                    <BookingOffer
                      id={booking.id}
                      price={booking.quoted_price!}
                      driverId={booking.driver_id}
                      onUpdated={onRefresh}
                      disabled={disabled}
                    />
                  ) : null}
                  {active && future && !inactive ? (
                    <button
                      type="button"
                      className="btn btn-secondary mt-3"
                      disabled={disabled}
                      onClick={() => onCancel(booking.id)}
                    >
                      Cancel request
                    </button>
                  ) : null}
                </div>
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
        <Icon name="clock" size={12} /> Updates automatically every 10 seconds.
      </p>
    </section>
  );
}
