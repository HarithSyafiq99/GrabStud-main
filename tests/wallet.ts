import test from "node:test";
import assert from "node:assert/strict";
import { walletRanges } from "../src/lib/wallet";
test("wallet periods use Malaysia midnight, Monday weeks, and calendar months", () => {
  const ranges = walletRanges(new Date("2026-10-04T16:01:00Z")); // Monday 00:01 in Malaysia.
  assert.equal(ranges.daily.start, "2026-10-04T16:00:00.000Z");
  assert.equal(ranges.daily.end, "2026-10-05T16:00:00.000Z");
  assert.equal(ranges.weekly.start, ranges.daily.start);
  assert.equal(ranges.weekly.end, "2026-10-11T16:00:00.000Z");
  assert.equal(ranges.monthly.start, "2026-09-30T16:00:00.000Z");
  assert.equal(ranges.monthly.end, "2026-10-31T16:00:00.000Z");
});
test("wallet boundaries handle Sunday, new year and leap February", () => {
  const sunday = walletRanges(new Date("2026-10-04T15:59:59Z"));
  assert.equal(sunday.weekly.start, "2026-09-27T16:00:00.000Z");
  const newYear = walletRanges(new Date("2026-12-31T16:00:00Z"));
  assert.equal(newYear.monthly.start, "2026-12-31T16:00:00.000Z");
  assert.equal(newYear.monthly.end, "2027-01-31T16:00:00.000Z");
  const leap = walletRanges(new Date("2028-02-29T04:00:00Z"));
  assert.equal(leap.monthly.end, "2028-02-29T16:00:00.000Z");
});
