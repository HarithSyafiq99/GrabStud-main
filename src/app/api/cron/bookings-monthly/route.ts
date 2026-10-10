import { timingSafeEqual } from "node:crypto";
import { ensureSchema, getDb } from "@/lib/db";
import { handleError, jsonError } from "@/lib/http";
import {
  archiveMonthlyBookings,
  isMonthRollover,
} from "@/lib/monthly-bookings";
import { bookingMonth } from "@/lib/booking-reports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET(request: Request) {
  try {
    const secret = process.env.CRON_SECRET;
    const header = Buffer.from(request.headers.get("authorization") ?? "");
    const expected = Buffer.from(`Bearer ${secret ?? ""}`);
    if (
      !secret ||
      secret.length < 32 ||
      header.length !== expected.length ||
      !timingSafeEqual(header, expected)
    )
      return jsonError("Unauthorized", 401);
    const mode = process.env.BOOKING_RETENTION_MODE ?? "all";
    if (mode !== "closed" && mode !== "all")
      return jsonError(
        "Monthly booking cleanup is not enabled. Set BOOKING_RETENTION_MODE to closed or all.",
        503,
      );
    await ensureSchema();
    const started = Date.now(),
      now = new Date();
    const db = getDb(),
      month = bookingMonth(now.toISOString());
    let run = (
      await db.execute({
        sql: "SELECT finished_at FROM monthly_booking_archive_runs WHERE month=?",
        args: [month],
      })
    ).rows[0];
    if (!run && !isMonthRollover(now))
      return Response.json(
        { ok: true, skipped: "not-month-end" },
        { headers: { "Cache-Control": "no-store" } },
      );
    if (!run) {
      await db.execute({
        sql: "INSERT OR IGNORE INTO monthly_booking_archive_runs (month,started_at) VALUES (?,?)",
        args: [month, now.toISOString()],
      });
      run = (
        await db.execute({
          sql: "SELECT finished_at FROM monthly_booking_archive_runs WHERE month=?",
          args: [month],
        })
      ).rows[0];
    }
    if (run.finished_at)
      return Response.json(
        { ok: true, skipped: "already-archived" },
        { headers: { "Cache-Control": "no-store" } },
      );
    let deleted = 0,
      reports = 0,
      more = false;
    do {
      const result = await archiveMonthlyBookings(getDb(), { mode, now });
      deleted += result.deleted;
      reports += result.reports;
      more = result.more;
    } while (more && Date.now() - started < 35000);
    if (!more)
      await db.execute({
        sql: "UPDATE monthly_booking_archive_runs SET finished_at=? WHERE month=? AND finished_at IS NULL",
        args: [now.toISOString(), month],
      });
    return Response.json(
      { ok: true, deleted, reports, more },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return handleError(error);
  }
}
