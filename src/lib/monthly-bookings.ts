import type { Client, InStatement } from "@libsql/client";
import { PDFDocument } from "pdf-lib";
import {
  bookingMonth,
  createBookingPdf,
  earnedFare,
  REPORT_BOOKING_SELECT,
  type ReportBooking,
} from "./booking-reports";
import { walletRanges } from "./wallet";
import { newId } from "./db";
import type { Role } from "./types";

export type RetentionMode = "closed" | "all";
export const ARCHIVE_BATCH_SIZE = 25;
export function isMonthRollover(now: Date) {
  return new Date(now.getTime() + 8 * 3600000).getUTCDate() === 1;
}
export function archiveCutoff(now: Date) {
  if (Number.isNaN(now.getTime())) throw new Error("Invalid archive date.");
  return walletRanges(now).monthly.start;
}

/** Save PDF backups, preserve earned totals and delete the same unchanged rows atomically. */
export async function archiveMonthlyBookings(
  db: Client,
  options: {
    mode: RetentionMode;
    now?: Date;
    createPdf?: typeof createBookingPdf;
  },
) {
  if (!["closed", "all"].includes(options.mode))
    throw new Error("Choose a valid booking retention mode.");
  const now = options.now ?? new Date(),
    cutoff = archiveCutoff(now);
  const condition =
    " WHERE b.created_at<? AND b.updated_at<?" +
    (options.mode === "closed"
      ? " AND b.status IN ('completed','cancelled','rejected')"
      : "");
  const selected = (
    await db.execute({
      sql:
        REPORT_BOOKING_SELECT +
        condition +
        " ORDER BY b.created_at ASC,b.id ASC LIMIT ?",
      args: [cutoff, cutoff, ARCHIVE_BATCH_SIZE],
    })
  ).rows as unknown as ReportBooking[];
  if (!selected.length) return { deleted: 0, reports: 0, cutoff, more: false };
  const groups = new Map<
    string,
    {
      owner: string | null;
      name: string;
      role: Role;
      month: string;
      rows: ReportBooking[];
    }
  >();
  for (const b of selected) {
    const month = bookingMonth(b.created_at);
    for (const [owner, name, role] of [
      [b.passenger_id, b.passenger_name ?? "Passenger", "passenger"],
      ...(b.driver_id
        ? [[b.driver_id, b.driver_name ?? "Driver", "driver"]]
        : []),
      [null, "All campus bookings", "admin"],
    ] as [string | null, string, Role][]) {
      const key = JSON.stringify([owner, role, month]);
      const group = groups.get(key) ?? { owner, name, role, month, rows: [] };
      group.rows.push(b);
      groups.set(key, group);
    }
  }
  const reports = [];
  for (const group of groups.values()) {
    group.rows.sort(
      (a, b) =>
        b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id),
    );
    const pdf = await (options.createPdf ?? createBookingPdf)(group.rows, {
      name: group.name,
      role: group.role,
      month: group.month,
      archived: true,
      now,
    });
    if (!(await PDFDocument.load(pdf)).getPageCount())
      throw new Error("A monthly PDF could not be verified.");
    reports.push({ ...group, id: newId(), pdf });
  }
  const ids = selected.map((b) => b.id),
    slots = ids.map(() => "?").join(",");
  const tx = await db.transaction("write");
  try {
    // Preparing PDFs outside the transaction avoids holding Turso's write lock during rendering.
    const current = (
      await tx.execute({
        sql:
          REPORT_BOOKING_SELECT +
          ` WHERE b.id IN (${slots}) ORDER BY b.created_at ASC,b.id ASC`,
        args: ids,
      })
    ).rows;
    if (JSON.stringify(current) !== JSON.stringify(selected))
      throw Object.assign(
        new Error(
          "Bookings changed while preparing their archive; retry the archive.",
        ),
        { status: 409 },
      );
    const writes: InStatement[] = [];
    for (const report of reports)
      writes.push({
        sql: "INSERT INTO monthly_booking_reports (id,owner_id,audience_role,month,booking_count,pdf_data,created_at,latest_booking_at,latest_booking_id) VALUES (?,?,?,?,?,?,?,?,?)",
        args: [
          report.id,
          report.owner,
          report.role,
          report.month,
          report.rows.length,
          Buffer.from(report.pdf),
          now.toISOString(),
          report.rows[0].created_at,
          report.rows[0].id,
        ],
      });
    for (const b of selected) {
      const income = earnedFare(b, now);
      if (income) {
        const day = walletRanges(new Date(b.arrived_at ?? b.departure_at)).daily
          .start;
        writes.push({
          sql: "INSERT INTO archived_driver_earnings (driver_id,recorded_day,payment_method,amount,journeys) VALUES (?,?,?,?,1) ON CONFLICT (driver_id,recorded_day,payment_method) DO UPDATE SET amount=amount+excluded.amount,journeys=journeys+1",
          args: [b.driver_id!, day, b.payment_method, income],
        });
      }
      if (b.ride_id && b.status === "accepted" && !b.arrived_at)
        writes.push({
          sql: "UPDATE rides SET seats_available=MIN(seats_total,seats_available+1),status='open' WHERE id=? AND status IN ('open','full')",
          args: [b.ride_id],
        });
    }
    writes.push({
      sql: `DELETE FROM bookings WHERE id IN (${slots})`,
      args: ids,
    });
    // One network round trip keeps the archive within Turso's transaction lifetime.
    const results = await tx.batch(writes);
    const deleted = results.at(-1)!;
    if (deleted.rowsAffected !== selected.length)
      throw new Error("The booking archive could not be completed safely.");
    await tx.execute({
      sql: "INSERT INTO audit_logs (id,actor_id,action,details,created_at) VALUES (?,NULL,'ARCHIVE_BOOKINGS',?,?)",
      args: [
        newId(),
        `Archived ${selected.length} booking(s) into ${reports.length} PDF report(s); mode=${options.mode}, cutoff=${cutoff}`,
        now.toISOString(),
      ],
    });
    await tx.commit();
    return {
      deleted: selected.length,
      reports: reports.length,
      cutoff,
      more: selected.length === ARCHIVE_BATCH_SIZE,
    };
  } catch (error) {
    if (!tx.closed) await tx.rollback();
    throw error;
  } finally {
    tx.close();
  }
}
