import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import { SCHEMA_SQL } from "../src/lib/schema";
import { initializeSchema } from "../src/lib/migrations";
import { BOOKING_SELECT } from "../src/lib/bookings";
const previousSchema = SCHEMA_SQL.replace(
  /^  (rejection_reason|deleted_at|session_version|profile_photo|car_colour|car_type|car_plate|onboarding_seen_at|passenger_count|pickup_note|pickup_lat|pickup_lng|destination_lat|destination_lng|arrived_at|arrival_acknowledged_at|rating_score|rating_feedback|rated_at).*\n/gm,
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
    assert.ok(users.rows.every((u) => u.deleted_at === null));
    const accepted = (
      await db.execute("SELECT * FROM bookings WHERE id='accepted'")
    ).rows[0];
    assert.equal(accepted.status, "accepted");
    assert.equal(accepted.passenger_count, 1);
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
    global.gc?.();
    await new Promise((resolve) => setTimeout(resolve, 100));
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

test("adding map pins preserves current bookings and repeated upgrades preserve coordinates", async () => {
  const dir = await mkdtemp(join(tmpdir(), "grabstudent-migration-"));
  const db = createClient({ url: "file:" + join(dir, "pins.db") });
  try {
    const previous = SCHEMA_SQL.replace(
      /^  (pickup_lat|pickup_lng|destination_lat|destination_lng).*\n/gm,
      "",
    );
    for (const sql of previous
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean))
      await db.execute(sql);
    await db.execute(
      "INSERT INTO users (id,name,email,password_hash,student_number,role,status,created_at,updated_at) VALUES ('p','Passenger','p@example.com','preserved','STUDENT','passenger','approved','2026-01-01','2026-01-01')",
    );
    await db.execute(
      "INSERT INTO bookings (id,passenger_id,from_zone,to_zone,departure_at,status,payment_method,pickup_note,created_at,updated_at) VALUES ('existing','p','Main Campus','Library','2099-01-01','pending','cash','Side gate','2026-01-01','2026-01-01')",
    );
    await initializeSchema(db);
    const existing = (
      await db.execute("SELECT * FROM bookings WHERE id='existing'")
    ).rows[0];
    assert.equal(existing.pickup_note, "Side gate");
    assert.equal(existing.status, "pending");
    assert.equal(existing.pickup_lat, null);
    assert.equal(existing.destination_lng, null);
    await db.execute(
      "UPDATE bookings SET pickup_lat=3.139,pickup_lng=101.686,destination_lat=3.15,destination_lng=101.71 WHERE id='existing'",
    );
    await initializeSchema(db);
    const preserved = (
      await db.execute("SELECT * FROM bookings WHERE id='existing'")
    ).rows[0];
    assert.equal(preserved.pickup_lat, 3.139);
    assert.equal(preserved.destination_lng, 101.71);
    assert.equal(
      (await db.execute("SELECT password_hash FROM users WHERE id='p'")).rows[0]
        .password_hash,
      "preserved",
    );
    assert.equal((await db.execute("PRAGMA foreign_key_check")).rows.length, 0);
  } finally {
    db.close();
    global.gc?.();
    await new Promise((resolve) => setTimeout(resolve, 100));
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

test("passenger-count upgrades preserve current booking details and existing group counts", async () => {
  for (const rebuilding of [false, true]) {
    const dir = await mkdtemp(join(tmpdir(), "grabstudent-migration-"));
    const db = createClient({ url: "file:" + join(dir, "passengers.db") });
    try {
      const previous = rebuilding
        ? SCHEMA_SQL.replace(
            "  ride_id TEXT REFERENCES rides(id) ON DELETE CASCADE,",
            "  ride_id TEXT NOT NULL REFERENCES rides(id) ON DELETE CASCADE,",
          )
        : SCHEMA_SQL.replace(/^  passenger_count.*\n/gm, "");
      for (const sql of previous
        .split(";")
        .map((s) => s.trim())
        .filter(Boolean))
        await db.execute(sql);
      for (const role of ["driver", "passenger"])
        await db.execute(
          `INSERT INTO users (id,name,email,password_hash,student_number,role,status,created_at,updated_at) VALUES ('${role}','${role}','${role}@example.com','preserved','STUDENT','${role}','approved','2026-01-01','2026-01-01')`,
        );
      await db.execute(
        "INSERT INTO rides VALUES ('ride','driver','Pickup','Destination','2099-01-01',4,1,20,'open','2026-01-01')",
      );
      await db.execute(
        "INSERT INTO bookings (id,ride_id,driver_id,passenger_id,from_zone,to_zone,departure_at,status,quoted_price,payment_method,pickup_note,pickup_lat,pickup_lng,destination_lat,destination_lng,created_at,updated_at) VALUES ('existing','ride','driver','passenger','Pickup','Destination','2099-01-01','accepted',2000,'cash','Side gate',3.14,101.68,3.15,101.7,'2026-01-01','2026-01-01')",
      );
      if (rebuilding)
        await db.execute(
          "UPDATE bookings SET passenger_count=3 WHERE id='existing'",
        );
      const before = (await db.execute("SELECT * FROM bookings")).rows[0];
      await initializeSchema(db);
      const after = (await db.execute("SELECT * FROM bookings")).rows[0];
      assert.equal(after.passenger_count, rebuilding ? 3 : 1);
      for (const key of [
        "id",
        "driver_id",
        "passenger_id",
        "from_zone",
        "to_zone",
        "status",
        "quoted_price",
        "payment_method",
        "created_at",
        "updated_at",
      ])
        assert.equal(after[key], before[key]);
      {
        for (const key of [
          "pickup_note",
          "pickup_lat",
          "pickup_lng",
          "destination_lat",
          "destination_lng",
        ])
          assert.equal(after[key], before[key]);
      }
      await db.execute(
        "UPDATE bookings SET passenger_count=4 WHERE id='existing'",
      );
      await initializeSchema(db);
      await initializeSchema(db);
      assert.equal(
        (await db.execute("SELECT * FROM bookings")).rows[0].passenger_count,
        4,
      );
      for (const count of [0, 5, 1.5, null])
        await assert.rejects(
          db.execute({
            sql: "UPDATE bookings SET passenger_count=? WHERE id='existing'",
            args: [count],
          }),
        );
      assert.equal(
        (await db.execute("PRAGMA foreign_key_check")).rows.length,
        0,
      );
    } finally {
      db.close();
      global.gc?.();
      await new Promise((resolve) => setTimeout(resolve, 100));
      assert.equal(
        dir.startsWith(join(tmpdir(), "grabstudent-migration-")),
        true,
      );
      await rm(dir, {
        recursive: true,
        force: true,
        maxRetries: 10,
        retryDelay: 200,
      });
    }
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
    assert.equal(offer.passenger_count, 1);
    assert.equal(Number(offer.quoted_price), 750);
    assert.equal(offer.driver_id, "driver");
    assert.equal(offer.from_zone, "Main Campus");
    assert.equal(offer.pickup_note, "");
    assert.equal(offer.arrived_at, null);
    assert.equal(offer.pickup_lat, null);
    assert.equal(offer.pickup_lng, null);
    assert.equal(offer.destination_lat, null);
    assert.equal(offer.destination_lng, null);
    const upgradedDriver = (
      await db.execute("SELECT * FROM users WHERE id='driver'")
    ).rows[0];
    assert.equal(upgradedDriver.profile_photo, null);
    assert.equal(upgradedDriver.car_type, "");
    assert.equal(upgradedDriver.onboarding_seen_at, "2026-01-01");
    await db.execute(
      "UPDATE bookings SET pickup_note='Side gate',arrived_at='2026-10-06T01:00:00Z',pickup_lat=3.139,pickup_lng=101.686,destination_lat=3.15,destination_lng=101.71 WHERE id='offer'",
    );
    await db.execute(
      "UPDATE users SET car_type='Myvi',onboarding_seen_at='2026-10-06T01:00:00Z' WHERE id='driver'",
    );
    await initializeSchema(db);
    const pins = (await db.execute("SELECT * FROM bookings WHERE id='offer'"))
      .rows[0];
    assert.equal(pins.pickup_lat, 3.139);
    assert.equal(pins.pickup_lng, 101.686);
    assert.equal(pins.destination_lat, 3.15);
    assert.equal(pins.destination_lng, 101.71);
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

test("retired review fields stay compatible without adding or exposing them", async () => {
  assert.equal(SCHEMA_SQL.includes("rating_score"), false);
  for (const rebuilding of [false, true]) {
    const dir = await mkdtemp(join(tmpdir(), "grabstudent-migration-"));
    const db = createClient({ url: "file:" + join(dir, "compatibility.db") });
    try {
      const schema = rebuilding
        ? SCHEMA_SQL.replace(
            "  ride_id TEXT REFERENCES rides(id) ON DELETE CASCADE,",
            "  ride_id TEXT NOT NULL REFERENCES rides(id) ON DELETE CASCADE,",
          )
        : SCHEMA_SQL;
      for (const sql of schema
        .split(";")
        .map((s) => s.trim())
        .filter(Boolean))
        await db.execute(sql);
      for (const [column, definition] of [
        ["rating_score", "INTEGER"],
        ["rating_feedback", "TEXT"],
        ["rated_at", "TEXT"],
      ])
        await db.execute(
          `ALTER TABLE bookings ADD COLUMN ${column} ${definition}`,
        );
      for (const role of ["driver", "passenger"])
        await db.execute({
          sql: "INSERT INTO users (id,name,email,password_hash,student_number,role,status,created_at,updated_at) VALUES (?,?,?,'preserved','STUDENT',?,'approved','2026-01-01','2026-01-01')",
          args: [role, role, role + "@example.com", role],
        });
      await db.execute(
        "INSERT INTO rides VALUES ('legacy-ride','driver','Pickup','Destination','2026-01-01',4,1,8,'open','2026-01-01')",
      );
      await db.execute(
        "INSERT INTO bookings (id,ride_id,driver_id,passenger_id,passenger_count,from_zone,to_zone,departure_at,status,quoted_price,payment_method,pickup_note,arrived_at,rating_score,rating_feedback,rated_at,created_at,updated_at) VALUES ('finished','legacy-ride','driver','passenger',3,'Pickup','Destination','2026-01-01','completed',800,'cash','Side gate','2026-01-01T00:01:00Z',4,'Historical feedback','2026-01-02','2026-01-01','2026-01-01')",
      );
      const before = (await db.execute("SELECT * FROM bookings")).rows[0];
      await initializeSchema(db);
      await initializeSchema(db);
      const after = (await db.execute("SELECT * FROM bookings")).rows[0];
      for (const [key, value] of Object.entries(before))
        assert.equal(after[key], value);
      const exposed = (await db.execute(BOOKING_SELECT)).rows[0];
      for (const column of [
        "rating_score",
        "rating_feedback",
        "rated_at",
        "driver_rating_average",
        "driver_rating_count",
      ])
        assert.equal(column in exposed, false);
      assert.equal(exposed.passenger_count, 3);
      assert.equal(exposed.quoted_price, 800);
      assert.equal(exposed.pickup_note, "Side gate");
      assert.equal(
        (await db.execute("PRAGMA foreign_key_check")).rows.length,
        0,
      );
    } finally {
      db.close();
      global.gc?.();
      await new Promise((r) => setTimeout(r, 100));
      assert.equal(
        dir.startsWith(join(tmpdir(), "grabstudent-migration-")),
        true,
      );
      await rm(dir, {
        recursive: true,
        force: true,
        maxRetries: 10,
        retryDelay: 200,
      });
    }
  }
});
