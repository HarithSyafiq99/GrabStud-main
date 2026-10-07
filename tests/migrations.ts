import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import { SCHEMA_SQL } from "../src/lib/schema";
import { initializeSchema } from "../src/lib/migrations";
const previousSchema = SCHEMA_SQL.replace(
  /^  (session_version|profile_photo|car_colour|car_type|car_plate|onboarding_seen_at|pickup_note|arrived_at|arrival_acknowledged_at).*\n/gm,
  "",
);

test("legacy migration preserves accounts, accepted fares, pending requests and seat counts", async () => {
  const dir = await mkdtemp(join(tmpdir(), "grabstudent-migration-"));
  const db = createClient({ url: "file:" + join(dir, "migration.db") });
  try {
    const legacy = previousSchema
      .replace("  phone_number TEXT NOT NULL DEFAULT '',\n", "")
      .replace("  quoted_price INTEGER CHECK (quoted_price > 0),\n", "")
      .replace(
        "  ride_id TEXT REFERENCES rides(id) ON DELETE CASCADE,",
        "  ride_id TEXT NOT NULL REFERENCES rides(id) ON DELETE CASCADE,",
      )
      .replace(
        "  driver_id TEXT REFERENCES users(id),\n  from_zone TEXT NOT NULL,\n  to_zone TEXT NOT NULL,\n  departure_at TEXT NOT NULL,\n",
        "",
      )
      .replace("'pending', 'offered', 'accepted'", "'pending', 'accepted'");
    for (const sql of legacy
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean))
      await db.execute(sql);
    for (const [id, role] of [
      ["driver", "driver"],
      ["passenger", "passenger"],
      ["passenger2", "passenger"],
    ])
      await db.execute({
        sql: "INSERT INTO users VALUES (?,?,?,?,?,?,?,NULL,NULL,?,?)",
        args: [
          id,
          id,
          id + "@example.com",
          "hash",
          "STUDENT",
          role,
          "approved",
          "2026-01-01",
          "2026-01-01",
        ],
      });
    await db.execute(
      "INSERT INTO rides VALUES ('ride','driver','Main Campus','Library','2099-01-01',2,1,3,'open','2026-01-01')",
    );
    await db.execute(
      "INSERT INTO bookings VALUES ('accepted','ride','passenger','accepted','cash','2026-01-01','2026-01-01')",
    );
    await db.execute(
      "INSERT INTO bookings VALUES ('pending','ride','passenger2','pending','qr','2026-01-01','2026-01-01')",
    );
    await db.execute(
      "INSERT INTO users VALUES ('demo-driver','Aiman','driver@grabstudent.edu','demo-hash','DEMO','driver','approved',NULL,NULL,'2026-01-01','2026-01-01')",
    );
    await initializeSchema(db);
    await initializeSchema(db);
    const users = await db.execute("SELECT * FROM users");
    assert.equal(users.rows.length, 4);
    assert.ok(
      users.rows
        .filter((u) => u.id !== "demo-driver")
        .every((u) => u.password_hash === "hash" && u.phone_number === ""),
    );
    const demo = users.rows.find((u) => u.id === "demo-driver")!;
    assert.equal(demo.email, "driver@grabstudent.com");
    assert.equal(demo.phone_number, "+60100000001");
    assert.equal(demo.password_hash, "demo-hash");
    assert.ok(users.rows.every((u) => Number(u.session_version) === 0));
    const accepted = (
      await db.execute("SELECT * FROM bookings WHERE id='accepted'")
    ).rows[0];
    assert.equal(accepted.status, "accepted");
    assert.equal(accepted.driver_id, "driver");
    assert.equal(accepted.from_zone, "Main Campus");
    assert.equal(accepted.to_zone, "Library");
    assert.equal(Number(accepted.quoted_price), 300);
    const pending = (
      await db.execute("SELECT * FROM bookings WHERE id='pending'")
    ).rows[0];
    assert.equal(pending.status, "pending");
    assert.equal(pending.quoted_price, null);
    assert.equal(
      Number(
        (await db.execute("SELECT seats_available FROM rides")).rows[0]
          .seats_available,
      ),
      1,
    );
    await db.execute(
      "UPDATE bookings SET status='offered',quoted_price=550 WHERE id='pending'",
    );
    await db.execute(
      "INSERT INTO bookings (id,passenger_id,from_zone,to_zone,departure_at,status,payment_method,created_at,updated_at) VALUES ('request','passenger','Library','Hostel A','2099-01-01','pending','cash','2026-01-01','2026-01-01')",
    );
    await initializeSchema(db);
    const request = (
      await db.execute("SELECT * FROM bookings WHERE id='request'")
    ).rows[0];
    assert.equal(request.ride_id, null);
    assert.equal(request.driver_id, null);
    assert.equal(request.status, "pending");
    assert.equal((await db.execute("PRAGMA foreign_key_check")).rows.length, 0);
  } finally {
    db.close();
    assert.equal(
      dir.startsWith(join(tmpdir(), "grabstudent-migration-")),
      true,
    );
    await rm(dir, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 200,
    });
  }
});

test("price-offer database upgrades keep offered fares and allow requests without a ride", async () => {
  const dir = await mkdtemp(join(tmpdir(), "grabstudent-migration-"));
  const db = createClient({ url: "file:" + join(dir, "offers.db") });
  try {
    const previous = previousSchema
      .replace(
        "  ride_id TEXT REFERENCES rides(id) ON DELETE CASCADE,",
        "  ride_id TEXT NOT NULL REFERENCES rides(id) ON DELETE CASCADE,",
      )
      .replace(
        "  driver_id TEXT REFERENCES users(id),\n  from_zone TEXT NOT NULL,\n  to_zone TEXT NOT NULL,\n  departure_at TEXT NOT NULL,\n",
        "",
      );
    for (const sql of previous
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean))
      await db.execute(sql);
    for (const [id, role] of [
      ["driver", "driver"],
      ["passenger", "passenger"],
    ])
      await db.execute({
        sql: "INSERT INTO users (id,name,email,password_hash,student_number,role,status,created_at,updated_at) VALUES (?,?,?,?,?,?,'approved',?,?)",
        args: [
          id,
          id,
          id + "@example.com",
          "unchanged-hash",
          "STUDENT",
          role,
          "2026-01-01",
          "2026-01-01",
        ],
      });
    await db.execute(
      "INSERT INTO rides VALUES ('ride','driver','Main Campus','Library','2099-01-01',2,2,3,'open','2026-01-01')",
    );
    await db.execute(
      "INSERT INTO bookings (id,ride_id,passenger_id,status,quoted_price,payment_method,created_at,updated_at) VALUES ('offer','ride','passenger','offered',750,'qr','2026-01-01','2026-01-01')",
    );
    await initializeSchema(db);
    await initializeSchema(db);
    const offer = (await db.execute("SELECT * FROM bookings WHERE id='offer'"))
      .rows[0];
    assert.equal(offer.status, "offered");
    assert.equal(Number(offer.quoted_price), 750);
    assert.equal(offer.driver_id, "driver");
    assert.equal(offer.from_zone, "Main Campus");
    assert.equal(offer.pickup_note, "");
    assert.equal(offer.arrived_at, null);
    const upgradedDriver = (
      await db.execute("SELECT * FROM users WHERE id='driver'")
    ).rows[0];
    assert.equal(upgradedDriver.profile_photo, null);
    assert.equal(upgradedDriver.car_type, "");
    assert.equal(upgradedDriver.onboarding_seen_at, "2026-01-01");
    await db.execute(
      "UPDATE bookings SET pickup_note='Side gate',arrived_at='2026-10-06T01:00:00Z' WHERE id='offer'",
    );
    await db.execute(
      "UPDATE users SET car_type='Myvi',onboarding_seen_at='2026-10-06T01:00:00Z' WHERE id='driver'",
    );
    await initializeSchema(db);
    assert.equal(
      (await db.execute("SELECT pickup_note FROM bookings WHERE id='offer'"))
        .rows[0].pickup_note,
      "Side gate",
    );
    assert.equal(
      (await db.execute("SELECT car_type FROM users WHERE id='driver'")).rows[0]
        .car_type,
      "Myvi",
    );
    assert.equal(offer.to_zone, "Library");
    assert.equal(
      Number(
        (await db.execute("SELECT seats_available FROM rides")).rows[0]
          .seats_available,
      ),
      2,
    );
    await db.execute(
      "INSERT INTO bookings (id,passenger_id,from_zone,to_zone,departure_at,payment_method,created_at,updated_at) VALUES ('new','passenger','Library','Hostel A','2099-01-01','cash','2026-01-01','2026-01-01')",
    );
    assert.equal(
      (await db.execute("SELECT ride_id FROM bookings WHERE id='new'")).rows[0]
        .ride_id,
      null,
    );
    assert.equal((await db.execute("PRAGMA foreign_key_check")).rows.length, 0);
  } finally {
    db.close();
    global.gc?.();
    assert.equal(
      dir.startsWith(join(tmpdir(), "grabstudent-migration-")),
      true,
    );
    await rm(dir, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 200,
    });
  }
});
