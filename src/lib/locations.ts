export type LocationPin = { lat: number; lng: number };

export function validLocationName(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length >= 2 &&
    value.trim().length <= 160 &&
    !/[\u0000-\u001f\u007f]/.test(value)
  );
}

/** Pins are optional for historical requests, but each supplied pair must be valid. */
export function parseLocationPin(
  lat: unknown,
  lng: unknown,
): LocationPin | null {
  if (lat == null && lng == null) return null;
  if (
    typeof lat !== "number" ||
    typeof lng !== "number" ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -85.05112878 ||
    lat > 85.05112878 ||
    lng < -180 ||
    lng > 180
  ) {
    throw new Error("Choose a valid map pin for your location.");
  }
  // Rounding at the map's polar boundary must still produce a valid saved pin.
  return {
    lat: Math.max(-85.051128, Math.min(85.051128, Math.round(lat * 1e6) / 1e6)),
    lng: Math.round(lng * 1e6) / 1e6,
  };
}

export function directionsUrl(pin: LocationPin, origin?: LocationPin | null) {
  const query = new URLSearchParams({
    api: "1",
    destination: `${pin.lat},${pin.lng}`,
    travelmode: "driving",
  });
  if (origin) query.set("origin", `${origin.lat},${origin.lng}`);
  return `https://www.google.com/maps/dir/?${query}`;
}
