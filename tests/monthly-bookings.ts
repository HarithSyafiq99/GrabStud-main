import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createClient, type Client } from "@libsql/client";
import { PDFDocument } from "pdf-lib";
import { initializeSchema } from "../src/lib/migrations";
import {
  archiveCutoff,
  archiveMonthlyBookings,
  isMonthRollover,
} from "../src/lib/monthly-bookings";
import {
  createBookingPdf,
  REPORT_BOOKING_SELECT,
  type ReportBooking,
} from "../src/lib/booking-reports";
import { WALLET_INCOME_SELECT } from "../src/lib/wallet";

const monthEnd = new Date("2026-10-31T16:00:00Z");
async function fixture(run: (db: Client) => Promise<void>) {
  const dir = await mkdtemp(join(tmpdir(), "grabstudent-monthly-"));
  const db = createClient({ url: "file:" + join(dir, "archive.db") });
  try {
    await initializeSchema(db);
    for (const [id, role] of [
      ["p", "passenger"],
      ["d", "driver"],
    ])
      await db.execute({
        sql: "INSERT INTO users (id,name,email,password_hash,student_number,role,status,created_at,updated_at) VALUES (?,?,?,'unused','TEST',?,'approved','2026-01-01','2026-01-01')",
        args: [
          id,
          id === "p" ? "José Passenger" : "Driver",
          id + "@example.com",
          role,
        ],
      });
    await run(db);
  } finally {
    db.close();
    global.gc?.();
    await new Promise((done) => setTimeout(done, 100));
    assert.ok(
      resolve(dir).startsWith(resolve(tmpdir(), "grabstudent-monthly-")),
    );
    await rm(dir, {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 200,
    });
  }
}
async function insert(
  db: Client,
  id: string,
  status = "completed",
  extra: {
    created?: string;
    updated?: string;
    arrived?: string | null;
    fare?: number;
    ride?: string;
    departure?: string;
    note?: string;
  } = {},
) {
  await db.execute({
    sql: "INSERT INTO bookings (id,ride_id,driver_id,passenger_id,from_zone,to_zone,departure_at,status,quoted_price,payment_method,pickup_note,arrived_at,created_at,updated_at) VALUES (?,?,'d','p','Campus → Gate','Station',?,?,?,'cash',?,?,?,?)",
    args: [
      id,
      extra.ride ?? null,
      extra.departure ?? "2026-10-15T01:00:00Z",
      status,
      extra.fare ?? 1250,
      extra.note ?? "Near the security booth",
      extra.arrived ?? null,
      extra.created ?? "2026-10-01T00:00:00Z",
      extra.updated ?? "2026-10-20T00:00:00Z",
    ],
  });
}
async function totals(db: Client) {
  return (
    await db.execute(
      `SELECT driver_id,SUM(amount) AS total,SUM(journeys) AS journeys FROM (${WALLET_INCOME_SELECT}) WHERE recorded_at<='2026-11-01T00:00:00Z' GROUP BY driver_id`,
    )
  ).rows;
}

test("monthly cutoff uses Malaysia month end, including 28/29 February and 30/31 days", () => {
  assert.equal(
    archiveCutoff(new Date("2026-10-31T15:59:59Z")),
    "2026-09-30T16:00:00.000Z",
  );
  assert.equal(archiveCutoff(monthEnd), "2026-10-31T16:00:00.000Z");
  assert.equal(
    archiveCutoff(new Date("2026-04-30T16:00:00Z")),
    "2026-04-30T16:00:00.000Z",
  );
  assert.equal(
    archiveCutoff(new Date("2027-02-28T16:00:00Z")),
    "2027-02-28T16:00:00.000Z",
  );
  assert.equal(
    archiveCutoff(new Date("2028-02-29T16:00:00Z")),
    "2028-02-29T16:00:00.000Z",
  );
  assert.equal(
    archiveCutoff(new Date("2026-12-31T16:00:00Z")),
    "2026-12-31T16:00:00.000Z",
  );
  assert.throws(() => archiveCutoff(new Date("invalid")));
  assert.equal(isMonthRollover(new Date("2026-10-31T15:59:59Z")), false);
  assert.equal(isMonthRollover(monthEnd), true);
  assert.equal(isMonthRollover(new Date("2026-11-02T00:00:00Z")), false);
});
test("closed retention saves role-specific PDFs, keeps active and current-month records, and preserves income", async () =>
  fixture(async (db) => {
    for (const status of [
      "completed",
      "cancelled",
      "rejected",
      "pending",
      "offered",
      "accepted",
    ])
      await insert(db, status, status);
    await insert(db, "current", "completed", {
      created: "2026-10-31T16:00:00Z",
      updated: "2026-10-31T16:00:00Z",
    });
    await insert(db, "recently-edited", "cancelled", {
      updated: "2026-10-31T16:00:00Z",
    });
    const before = await totals(db);
    const result = await archiveMonthlyBookings(db, {
      mode: "closed",
      now: monthEnd,
    });
    assert.equal(result.deleted, 3);
    assert.equal(result.reports, 3);
    assert.deepEqual(
      (await db.execute("SELECT id FROM bookings ORDER BY id")).rows.map(
        (r) => r.id,
      ),
      ["accepted", "current", "offered", "pending", "recently-edited"],
    );
    assert.deepEqual(await totals(db), before);
    const reports = (await db.execute("SELECT * FROM monthly_booking_reports"))
      .rows;
    for (const r of reports) {
      assert.equal(r.month, "2026-10");
      assert.equal(r.booking_count, 3);
      const pdf = await PDFDocument.load(
        new Uint8Array(r.pdf_data as ArrayBuffer),
      );
      assert.ok(pdf.getPageCount() > 0);
      assert.equal(pdf.getAuthor(), "GrabStudent");
      assert.equal(
        r.owner_id,
        r.audience_role === "admin"
          ? null
          : r.audience_role === "passenger"
            ? "p"
            : "d",
      );
    }
    await initializeSchema(db);
    assert.equal(
      (await db.execute("SELECT COUNT(*) AS n FROM monthly_booking_reports"))
        .rows[0].n,
      3,
    );
    assert.equal((await db.execute("PRAGMA foreign_key_check")).rows.length, 0);
  }));
test("all retention archives old active bookings, returns legacy seats, and records arrival earnings once", async () =>
  fixture(async (db) => {
    await db.execute(
      "INSERT INTO rides (id,driver_id,from_zone,to_zone,departure_at,seats_total,seats_available,flat_rate,status,created_at) VALUES ('ride','d','Campus','Station','2026-12-01',1,0,12,'full','2026-10-01')",
    );
    await insert(db, "future-booked", "accepted", {
      ride: "ride",
      departure: "2026-12-01T00:00:00Z",
    });
    await insert(db, "arrived", "accepted", {
      arrived: "2026-10-15T00:00:00Z",
    });
    await insert(db, "offered", "offered");
    const before = await totals(db);
    assert.equal(
      (await archiveMonthlyBookings(db, { mode: "all", now: monthEnd }))
        .deleted,
      3,
    );
    assert.deepEqual(await totals(db), before);
    assert.equal(
      (await db.execute("SELECT seats_available,status FROM rides")).rows[0]
        .seats_available,
      1,
    );
    assert.equal(
      (await db.execute("SELECT seats_available,status FROM rides")).rows[0]
        .status,
      "open",
    );
    const repeat = await archiveMonthlyBookings(db, {
      mode: "all",
      now: monthEnd,
    });
    assert.equal(repeat.deleted, 0);
    assert.equal(repeat.reports, 0);
    assert.deepEqual(await totals(db), before);
    assert.equal(
      (
        await db.execute(
          "SELECT COUNT(*) AS n FROM audit_logs WHERE action='ARCHIVE_BOOKINGS'",
        )
      ).rows[0].n,
      1,
    );
  }));
test("failed PDF generation never deletes bookings or changes income", async () =>
  fixture(async (db) => {
    await insert(db, "keep");
    const before = await totals(db);
    await assert.rejects(
      archiveMonthlyBookings(db, {
        mode: "closed",
        now: monthEnd,
        createPdf: async () => {
          throw new Error("fixture PDF failure");
        },
      }),
      /fixture PDF failure/,
    );
    assert.equal(
      (await db.execute("SELECT COUNT(*) AS n FROM bookings")).rows[0].n,
      1,
    );
    assert.equal(
      (await db.execute("SELECT COUNT(*) AS n FROM monthly_booking_reports"))
        .rows[0].n,
      0,
    );
    assert.deepEqual(await totals(db), before);
  }));
test("database failures roll back PDFs, earnings, seat changes and deletion together", async () =>
  fixture(async (db) => {
    await insert(db, "keep");
    const before = await totals(db);
    await db.execute(
      "CREATE TRIGGER block_purge BEFORE DELETE ON bookings BEGIN SELECT RAISE(ABORT,'fixture blocked delete'); END",
    );
    await assert.rejects(
      archiveMonthlyBookings(db, { mode: "closed", now: monthEnd }),
      /fixture blocked delete/,
    );
    assert.equal(
      (await db.execute("SELECT COUNT(*) AS n FROM bookings")).rows[0].n,
      1,
    );
    assert.equal(
      (await db.execute("SELECT COUNT(*) AS n FROM monthly_booking_reports"))
        .rows[0].n,
      0,
    );
    assert.equal(
      (await db.execute("SELECT COUNT(*) AS n FROM archived_driver_earnings"))
        .rows[0].n,
      0,
    );
    assert.deepEqual(await totals(db), before);
  }));
test("a concurrent booking update prevents stale PDF deletion", async () =>
  fixture(async (db) => {
    await insert(db, "changed");
    let changed = false;
    await assert.rejects(
      archiveMonthlyBookings(db, {
        mode: "closed",
        now: monthEnd,
        createPdf: async (rows, options) => {
          if (!changed) {
            changed = true;
            await db.execute(
              "UPDATE bookings SET pickup_note='New pickup remark' WHERE id='changed'",
            );
          }
          return createBookingPdf(rows, options);
        },
      }),
      (e: { status?: number }) => e.status === 409,
    );
    assert.equal(
      (await db.execute("SELECT pickup_note FROM bookings")).rows[0]
        .pickup_note,
      "New pickup remark",
    );
    assert.equal(
      (await db.execute("SELECT COUNT(*) AS n FROM monthly_booking_reports"))
        .rows[0].n,
      0,
    );
  }));
test("archive batches catch up after missed month ends without duplicating income", async () =>
  fixture(async (db) => {
    const statements = [];
    for (let i = 0; i < 102; i++)
      statements.push({
        sql: "INSERT INTO bookings (id,driver_id,passenger_id,from_zone,to_zone,departure_at,status,quoted_price,payment_method,created_at,updated_at) VALUES (?,'d','p','Campus','Station','2026-09-02T00:00:00Z','completed',100,'qr','2026-09-01','2026-09-02')",
        args: ["batch-" + i],
      });
    await db.batch(statements, "write");
    const before = await totals(db);
    const first = await archiveMonthlyBookings(db, {
      mode: "closed",
      now: monthEnd,
    });
    assert.equal(first.deleted, 25);
    assert.equal(first.more, true);
    let deleted = first.deleted;
    let more: boolean = first.more;
    while (more) {
      const result = await archiveMonthlyBookings(db, {
        mode: "closed",
        now: monthEnd,
      });
      deleted += result.deleted;
      more = result.more;
    }
    assert.equal(deleted, 102);
    assert.deepEqual(await totals(db), before);
    assert.equal(
      (
        await db.execute(
          "SELECT SUM(booking_count) AS n FROM monthly_booking_reports WHERE audience_role='driver'",
        )
      ).rows[0].n,
      102,
    );
    assert.equal(
      (await db.execute("SELECT COUNT(*) AS n FROM bookings")).rows[0].n,
      0,
    );
  }));
test("PDF reports handle empty lists, long text, accents and unsupported glyphs without dropping pages", async () =>
  fixture(async (db) => {
    const empty = await createBookingPdf([], {
      name: "José",
      role: "passenger",
      now: monthEnd,
    });
    assert.equal((await PDFDocument.load(empty)).getPageCount(), 1);
    await insert(db, "long", "completed", {
      note: "入口 " + "Long pickup landmark ".repeat(40),
    });
    const rows = (await db.execute(REPORT_BOOKING_SELECT))
      .rows as unknown as ReportBooking[];
    const pdf = await createBookingPdf([...rows, ...rows, ...rows], {
      name: "José",
      role: "driver",
      now: monthEnd,
    });
    assert.ok((await PDFDocument.load(pdf)).getPageCount() > 1);
    assert.ok(pdf.length > 1000);
  }));
