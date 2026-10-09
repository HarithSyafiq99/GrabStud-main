import test from "node:test";
import assert from "node:assert/strict";
import {
  locationAddress,
  lookupLocation,
  LocationLookupError,
} from "../src/lib/geocoding";

test("addresses remove duplicate components and fit the booking limit", () => {
  assert.equal(
    locationAddress({
      name: "KL Sentral",
      locality: "KL Sentral",
      street: "Jalan Stesen Sentral",
      city: "Kuala Lumpur",
      country: "Malaysia",
    }),
    "KL Sentral, Jalan Stesen Sentral, Kuala Lumpur, Malaysia",
  );
  assert.equal(
    locationAddress({ name: "A\nB", housenumber: 12, street: "Road" }),
    "A B, 12 Road",
  );
  assert.equal(locationAddress({}), "");
  assert.ok(
    locationAddress({ name: "A".repeat(155), city: "Town" }).length <= 160,
  );
});

test("lookup parses search pins, keeps exact reverse pins and handles provider failures", async (t) => {
  const originalFetch = globalThis.fetch,
    originalBase = process.env.GEOCODING_BASE_URL;
  process.env.GEOCODING_BASE_URL = "https://fixture.invalid";
  t.after(() => {
    globalThis.fetch = originalFetch;
    if (originalBase === undefined) delete process.env.GEOCODING_BASE_URL;
    else process.env.GEOCODING_BASE_URL = originalBase;
  });
  let calls = 0;
  const feature = (coordinates: unknown[], name = "Library") => ({
    geometry: { coordinates },
    properties: { name, street: "Main Street", city: "Town" },
  });
  globalThis.fetch = (async (url: URL) => {
    calls++;
    if (url.searchParams.get("q") === "Failure")
      return new Response("unavailable", { status: 503 });
    if (url.searchParams.get("q") === "Malformed")
      return Response.json({ features: null });
    if (url.searchParams.get("q") === "Empty")
      return Response.json({ features: [] });
    if (url.pathname.includes("reverse")) {
      assert.deepEqual(url.searchParams.getAll("layer"), ["house", "street"]);
      assert.equal(url.searchParams.get("radius"), "0.25");
      return Response.json({ features: [feature([101.7, 3.2])] });
    }
    assert.equal(url.searchParams.get("lat"), "3.14");
    return Response.json({
      features: [
        feature([101.6869876, 3.1391234]),
        feature(["bad", 3]),
        feature([101.7, 90]),
      ],
    });
  }) as typeof fetch;
  const input = {
    action: "search" as const,
    query: "Library",
    nearby: { lat: 3.14, lng: 101.7 },
  };
  const [first, simultaneous] = await Promise.all([
    lookupLocation(input),
    lookupLocation(input),
  ]);
  assert.deepEqual(first, [
    { address: "Library, Main Street, Town", lat: 3.139123, lng: 101.686988 },
  ]);
  assert.deepEqual(simultaneous, first);
  assert.deepEqual(await lookupLocation(input), first);
  assert.equal(calls, 1, "simultaneous and repeated lookups reuse results");
  const pin = { lat: 3.141234, lng: 101.681234 };
  assert.deepEqual(await lookupLocation({ action: "reverse", pin }), [
    { address: "Library, Main Street, Town", ...pin },
  ]);
  assert.deepEqual(
    await lookupLocation({ action: "search", query: "Empty" }),
    [],
  );
  for (const query of ["Failure", "Malformed"])
    await assert.rejects(
      lookupLocation({ action: "search", query }),
      (error: unknown) =>
        error instanceof LocationLookupError &&
        error.status === 503 &&
        /temporarily unavailable/.test(error.message),
    );
});
