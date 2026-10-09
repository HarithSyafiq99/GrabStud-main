import { NextResponse } from "next/server";
import { getSession, requireApproved, requireRole } from "@/lib/auth";
import { handleError, jsonError } from "@/lib/http";
import { parseLocationPin, validLocationName } from "@/lib/locations";
import {
  LocationLookupError,
  lookupLocation,
  type LocationLookup,
} from "@/lib/geocoding";

const requests = new Map<string, number>();
export async function POST(request: Request) {
  try {
    const user = requireApproved(
      requireRole(await getSession(), ["passenger"]),
    );
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonError("Enter a valid location request.");
    }
    if (!body || typeof body !== "object")
      return jsonError("Enter a valid location request.");
    let input: LocationLookup;
    try {
      if (body.action === "search") {
        if (!validLocationName(body.query))
          return jsonError("Enter an address with 2 to 160 characters.");
        input = {
          action: "search",
          query: body.query.trim(),
          nearby: parseLocationPin(body.nearby?.lat, body.nearby?.lng),
        };
      } else if (body.action === "reverse") {
        const pin = parseLocationPin(body.lat, body.lng);
        if (!pin) return jsonError("Choose a point on the map first.");
        input = { action: "reverse", pin };
      } else return jsonError("Choose address search or map address lookup.");
    } catch (error) {
      return jsonError((error as Error).message);
    }
    const now = Date.now();
    if ((requests.get(user.id) ?? 0) > now - 800)
      return jsonError("Please wait a moment before searching again.", 429);
    if (requests.size >= 1000) {
      for (const [id, time] of requests)
        if (time < now - 60000) requests.delete(id);
      if (requests.size >= 1000) requests.delete(requests.keys().next().value!);
    }
    requests.set(user.id, now);
    const locations = await lookupLocation(input);
    return NextResponse.json(
      { locations },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    if (error instanceof LocationLookupError)
      return jsonError(error.message, error.status);
    return handleError(error);
  }
}
