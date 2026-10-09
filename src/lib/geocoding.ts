import { parseLocationPin, type LocationPin } from "./locations";

export type AddressLocation = LocationPin & { address: string };
export type LocationLookup =
  | { action: "search"; query: string; nearby?: LocationPin | null }
  | { action: "reverse"; pin: LocationPin };

type Feature = {
  geometry?: { coordinates?: unknown[] };
  properties?: Record<string, unknown>;
};

export class LocationLookupError extends Error {
  constructor(
    message: string,
    public status = 503,
  ) {
    super(message);
  }
}

export function locationAddress(properties: Record<string, unknown>) {
  const clean = (value: unknown) =>
    typeof value === "string" || typeof value === "number"
      ? String(value)
          .replace(/[\u0000-\u001f\u007f]/g, " ")
          .trim()
      : "";
  const parts = [
    clean(properties.name),
    [clean(properties.housenumber), clean(properties.street)]
      .filter(Boolean)
      .join(" "),
    clean(properties.locality) || clean(properties.district),
    clean(properties.city),
    clean(properties.state),
    clean(properties.country),
  ].filter(Boolean);
  const unique = parts.filter(
    (part, i) =>
      parts.findIndex((other) => other.toLowerCase() === part.toLowerCase()) ===
      i,
  );
  // Keep complete components within the booking address limit.
  let address = "";
  for (const part of unique) {
    const next = address ? `${address}, ${part}` : part;
    if (next.length <= 160) address = next;
  }
  return address.length >= 2 ? address : "";
}

// Bounded, short-lived caches reduce repeated requests to the shared service.
const cache = new Map<
  string,
  { expires: number; results: AddressLocation[] }
>();
const pending = new Map<string, Promise<AddressLocation[]>>();
let nextRequestAt = 0;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function lookupLocation(
  input: LocationLookup,
): Promise<AddressLocation[]> {
  const base = process.env.GEOCODING_BASE_URL || "https://photon.komoot.io";
  const url = new URL(
    input.action === "search" ? "api/" : "reverse",
    `${base.replace(/\/$/, "")}/`,
  );
  url.searchParams.set("lang", "en");
  url.searchParams.set("limit", input.action === "search" ? "3" : "1");
  if (input.action === "search") {
    url.searchParams.set("q", input.query.trim());
    const bias = input.nearby ?? { lat: 3.139, lng: 101.686 };
    url.searchParams.set("lat", String(bias.lat));
    url.searchParams.set("lon", String(bias.lng));
  } else {
    url.searchParams.set("lat", String(input.pin.lat));
    url.searchParams.set("lon", String(input.pin.lng));
    url.searchParams.append("layer", "house");
    url.searchParams.append("layer", "street");
    url.searchParams.set("radius", "0.25");
  }
  const key = url.toString();
  const saved = cache.get(key);
  if (saved && saved.expires > Date.now()) return saved.results;
  const existing = pending.get(key);
  if (existing) return existing;
  if (pending.size >= 10)
    throw new LocationLookupError(
      "Address search is busy. Please try again shortly.",
      429,
    );
  const operation = (async () => {
    const start = Math.max(Date.now(), nextRequestAt);
    nextRequestAt = start + 1000;
    await sleep(Math.max(0, start - Date.now()));
    try {
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": "GrabStudent/1.0 (+https://grabstudent.vercel.app)",
        },
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Address service unavailable");
      const data = (await response.json()) as { features?: Feature[] };
      if (!Array.isArray(data.features))
        throw new Error("Invalid address response");
      const results: AddressLocation[] = [];
      for (const feature of data.features.slice(0, 3)) {
        const address = locationAddress(feature.properties ?? {});
        let pin: LocationPin | null;
        try {
          // Reverse lookup names the exact chosen point, never moves it to a nearby street.
          pin =
            input.action === "reverse"
              ? input.pin
              : parseLocationPin(
                  feature.geometry?.coordinates?.[1],
                  feature.geometry?.coordinates?.[0],
                );
        } catch {
          continue;
        }
        if (
          address &&
          pin &&
          !results.some(
            (item) =>
              item.address === address &&
              item.lat === pin.lat &&
              item.lng === pin.lng,
          )
        )
          results.push({ address, ...pin });
      }
      if (cache.size >= 200) cache.delete(cache.keys().next().value!);
      cache.set(key, { expires: Date.now() + 15 * 60 * 1000, results });
      return results;
    } catch {
      throw new LocationLookupError(
        "Address lookup is temporarily unavailable. Please try again or mark the map and enter the address manually.",
      );
    }
  })();
  pending.set(key, operation);
  try {
    return await operation;
  } finally {
    pending.delete(key);
  }
}
