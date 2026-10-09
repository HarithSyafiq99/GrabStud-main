"use client";
import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import type { LocationPin } from "@/lib/locations";
import { LoadingEmblem } from "./LoadingOverlay";
import { Notice } from "./UI";

export type MapPoint = LocationPin & {
  label: string;
  kind: "pickup" | "destination";
};
export function LocationMap({
  value = null,
  points = [],
  onSelect,
  onCentre,
  selectionKind = "pickup",
}: {
  value?: LocationPin | null;
  points?: MapPoint[];
  onSelect?: (pin: LocationPin) => void;
  onCentre?: (getCentre: (() => LocationPin) | null) => void;
  selectionKind?: "pickup" | "destination";
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const marker = useRef<Leaflet.Marker | null>(null);
  const callbacks = useRef({ onSelect, onCentre });
  callbacks.current = { onSelect, onCentre };
  const initial = useRef({ value, points, selectionKind });
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [tilesLoading, setTilesLoading] = useState(true);
  useEffect(() => {
    let disposed = false;
    let resize: ResizeObserver | undefined;
    async function setup() {
      try {
        const L = await import("leaflet");
        if (disposed || !container.current) return;
        const reduced = window.matchMedia(
          "(prefers-reduced-motion: reduce)",
        ).matches;
        const instance = L.map(container.current, {
          scrollWheelZoom: false,
          zoomAnimation: !reduced,
          fadeAnimation: !reduced,
          markerZoomAnimation: !reduced,
        });
        map.current = instance;
        const center = initial.current.value || initial.current.points[0];
        instance.setView(
          center ? [center.lat, center.lng] : [4.2, 108.5],
          center ? 16 : 5,
        );
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
        })
          .on("tileerror", () => {
            if (!disposed) {
              setTilesLoading(false);
              setError(
                "Map tiles could not load. Check your connection and reopen the map.",
              );
            }
          })
          .on("loading", () => {
            if (!disposed) setTilesLoading(true);
          })
          .on("load", () => {
            if (!disposed) setTilesLoading(false);
          })
          .addTo(instance);
        const icon = (kind: string) =>
          L.divIcon({
            className: "journey-map-marker",
            html: `<span class="journey-map-pin ${kind}">${kind === "destination" ? "D" : "P"}</span>`,
            iconSize: [36, 44],
            iconAnchor: [18, 44],
            tooltipAnchor: [0, -40],
          });
        for (const point of initial.current.points) {
          const label = document.createElement("span");
          label.textContent = `${point.kind === "pickup" ? "Pickup" : "Destination"}: ${point.label}`;
          L.marker([point.lat, point.lng], {
            icon: icon(point.kind),
            title: label.textContent,
          })
            .bindTooltip(label)
            .addTo(instance);
        }
        if (initial.current.points.length > 1) {
          instance.fitBounds(
            L.latLngBounds(initial.current.points.map((p) => [p.lat, p.lng])),
            { padding: [36, 36], maxZoom: 16, animate: false },
          );
        }
        if (callbacks.current.onSelect) {
          const selection = L.marker(
            initial.current.value
              ? [initial.current.value.lat, initial.current.value.lng]
              : instance.getCenter(),
            {
              icon: icon(initial.current.selectionKind),
              draggable: true,
              title: "Drag to adjust your location pin",
            },
          );
          marker.current = selection;
          if (initial.current.value) selection.addTo(instance);
          selection.on("dragend", () => {
            const point = selection.getLatLng().wrap();
            callbacks.current.onSelect?.({ lat: point.lat, lng: point.lng });
          });
          instance.on("click", (event: Leaflet.LeafletMouseEvent) => {
            const point = event.latlng.wrap();
            callbacks.current.onSelect?.({ lat: point.lat, lng: point.lng });
          });
        }
        callbacks.current.onCentre?.(() => {
          const point = instance.getCenter().wrap();
          return { lat: point.lat, lng: point.lng };
        });
        resize = new ResizeObserver(() =>
          instance.invalidateSize({ animate: false }),
        );
        resize.observe(container.current);
        setReady(true);
      } catch {
        if (!disposed) {
          setReady(true);
          setTilesLoading(false);
          setError("The map could not open. Please close it and try again.");
        }
      }
    }
    void setup();
    return () => {
      disposed = true;
      resize?.disconnect();
      callbacks.current.onCentre?.(null);
      map.current?.remove();
      map.current = null;
      marker.current = null;
    };
  }, []);
  useEffect(() => {
    if (!ready || !map.current || !marker.current || !value) return;
    marker.current.setLatLng([value.lat, value.lng]).addTo(map.current);
    map.current.setView(
      [value.lat, value.lng],
      Math.max(map.current.getZoom(), 16),
      { animate: false },
    );
  }, [value, ready]);
  return (
    <div className="journey-map-shell">
      <div
        ref={container}
        className="journey-map"
        aria-label={
          onSelect
            ? "Choose a location: tap the map, or pan with arrow keys and use Place pin at centre"
            : "Pickup and destination map"
        }
      />
      {!ready || tilesLoading ? (
        <div className="journey-map-loading">
          <LoadingEmblem />
          <span role="status">Opening your map…</span>
        </div>
      ) : null}
      <Notice message={error} error />
    </div>
  );
}
