"use client";
import { useState } from "react";
import type { BookingRecord } from "@/lib/types";
import { directionsUrl, parseLocationPin } from "@/lib/locations";
import { Icon } from "./Icon";
import { Modal } from "./Modal";
import { LocationMap, type MapPoint } from "./LocationMap";

export function BookingLocations({ booking }: { booking: BookingRecord }) {
  const [open, setOpen] = useState(false);
  const pickup = parseLocationPin(booking.pickup_lat, booking.pickup_lng);
  const destination = parseLocationPin(
    booking.destination_lat,
    booking.destination_lng,
  );
  const points: MapPoint[] = [];
  if (pickup)
    points.push({ ...pickup, kind: "pickup", label: booking.from_zone });
  if (destination)
    points.push({
      ...destination,
      kind: "destination",
      label: booking.to_zone,
    });
  if (!points.length) return null;
  return (
    <div className="booking-locations">
      <span className="eyebrow">PASSENGER’S MAP PINS</span>
      <div className="booking-location-actions">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => setOpen(true)}
        >
          <Icon name="pin" size={16} />
          View location map
        </button>
      </div>
      <Modal
        open={open}
        title="Your journey locations"
        className="location-modal"
        onClose={() => setOpen(false)}
      >
        <div className="location-map-legend">
          {points.map((point) => (
            <p key={point.kind}>
              <span className={`location-legend-dot ${point.kind}`}>
                {point.kind === "pickup" ? "P" : "D"}
              </span>
              <span>
                <small>
                  {point.kind === "pickup" ? "Pickup" : "Destination"}
                </small>
                <strong>{point.label}</strong>
              </span>
            </p>
          ))}
        </div>
        {open ? <LocationMap points={points} /> : null}
        <div className="location-map-tools">
          {pickup ? (
            <a
              className="btn btn-primary"
              href={directionsUrl(pickup)}
              target="_blank"
              rel="noopener noreferrer"
            >
              Directions to pickup
              <Icon name="arrow" size={16} />
            </a>
          ) : null}
          {destination ? (
            <a
              className="btn btn-secondary"
              href={directionsUrl(destination, pickup)}
              target="_blank"
              rel="noopener noreferrer"
            >
              Directions to destination
              <Icon name="arrow" size={16} />
            </a>
          ) : null}
        </div>
      </Modal>
    </div>
  );
}
