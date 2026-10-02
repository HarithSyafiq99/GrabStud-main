import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import { hash } from "bcryptjs";
import { createServer } from "node:net";
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

test(
  "GrabStudent complete MVP journeys and concurrency",
  { timeout: 180000 },
  async (t) => {
    const dir = await mkdtemp(join(tmpdir(), "grabstudent-test-"));
    const url = `file:${join(dir, "test.db")}`;
    const db = createClient({ url });
    const schema = await readFile("src/lib/schema.sql", "utf8");
    for (const sql of schema
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean))
      await db.execute(sql);
    const now = new Date().toISOString(),
      password = await hash("TestPass123!", 10);
    await db.execute({
      sql: "INSERT INTO users (id,name,email,password_hash,student_number,role,status,student_id_doc,license_doc,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
      args: [
        "admin",
        "Admin",
        "admin@example.com",
        password,
        "ADMIN",
        "admin",
        "approved",
        null,
        null,
        now,
        now,
      ],
    });
    const port = await new Promise((resolve) => {
      const s = createServer();
      s.listen(0, "127.0.0.1", () => {
        const p = s.address().port;
        s.close(() => resolve(p));
      });
    });
    let output = "";
    const proc = spawn(
      process.execPath,
      [
        "node_modules/next/dist/bin/next",
        "dev",
        "--hostname",
        "127.0.0.1",
        "--port",
        String(port),
      ],
      {
        env: {
          ...process.env,
          TURSO_DATABASE_URL: url,
          AUTH_SECRET: "integration-only-32-character-secret-value",
          NEXT_PUBLIC_DEMO_MODE: "false",
          GRABSTUDENT_DIST_DIR: ".next-test",
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    proc.stdout.on("data", (d) => (output += d));
    proc.stderr.on("data", (d) => (output += d));
    t.after(async () => {
      if (process.platform === "win32") {
        await new Promise((resolve, reject) => {
          const stop = spawn(
            "taskkill",
            ["/pid", String(proc.pid), "/T", "/F"],
            { windowsHide: true, stdio: "ignore" },
          );
          stop.once("error", reject);
          stop.once("exit", resolve);
        });
      } else {
        proc.kill("SIGTERM");
        if (proc.exitCode === null)
          await new Promise((resolve) => {
            proc.once("exit", resolve);
            setTimeout(() => {
              proc.kill("SIGKILL");
              resolve();
            }, 5000).unref();
          });
      }
      db.close();
      // Native SQLite statements can retain Windows file handles until collected.
      global.gc?.();
      await delay(100);
      assert.equal(dir.startsWith(join(tmpdir(), "grabstudent-test-")), true);
      await rm(dir, {
        recursive: true,
        force: true,
        maxRetries: 10,
        retryDelay: 200,
      });
    });
    const base = `http://127.0.0.1:${port}`;
    for (let i = 0; i < 100; i++) {
      try {
        const r = await fetch(`${base}/login`);
        if (r.ok) break;
      } catch {}
      if (proc.exitCode !== null) throw new Error(output);
      await delay(500);
      if (i === 99) throw new Error("Server not ready: " + output);
    }
    const client = () => ({
      cookie: "",
      async request(path, method = "GET", body) {
        const res = await fetch(base + path, {
          method,
          headers: {
            "Content-Type": "application/json",
            Cookie: this.cookie,
            Origin: base,
          },
          body: body ? JSON.stringify(body) : undefined,
        });
        const c = res.headers.get("set-cookie");
        if (c) this.cookie = c.split(";")[0];
        const text = await res.text();
        let data;
        try {
          data = JSON.parse(text);
        } catch {
          data = text;
        }
        return { status: res.status, data };
      },
    });
    const admin = client(),
      driver = client(),
      driver2 = client(),
      p1 = client(),
      p2 = client(),
      stranger = client();
    const doc =
      "data:image/png;base64," +
      (await readFile("public/demo/student-id.png")).toString("base64");
    const registration = (role, email) => ({
      name: email.split("@")[0],
      email,
      phone_number: "+60123456789",
      password: "TestPass123!",
      student_number: email,
      role,
      student_id_doc: doc,
      license_doc: role === "driver" ? doc : null,
    });
    const future = new Date(Date.now() + 7200000).toISOString();
    const journey = {
      from_zone: "Main Campus",
      to_zone: "Library",
      departure_at: future,
      payment_method: "qr",
    };
    let driverId, driver2Id, p1Id, p2Id, b1, b2, chosen, other, chosenId;
    const patch = async (c, id, action, extra = {}) => {
      let reviewed = {};
      if (["confirm", "decline"].includes(action)) {
        const offer = (await c.request("/api/bookings")).data.bookings?.find(
          (b) => b.id === id,
        );
        if (offer)
          reviewed = {
            quoted_price: offer.quoted_price,
            driver_id: offer.driver_id,
          };
      }
      return c.request("/api/bookings/" + id, "PATCH", {
        action,
        ...reviewed,
        ...extra,
      });
    };
    const request = (c, extra = {}) =>
      c.request("/api/bookings", "POST", { ...journey, ...extra });

    await t.test(
      "unauthenticated and cross-origin writes are blocked",
      async () => {
        assert.equal((await stranger.request("/api/bookings")).status, 401);
        assert.equal((await request(stranger)).status, 401);
        for (const origin of [
          "https://evil.example",
          "null",
          base.replace("http:", "https:"),
        ]) {
          const result = await fetch(base + "/api/auth/login", {
            method: "POST",
            headers: {
              Origin: origin,
              "Content-Type": "application/json",
            },
            body: "{}",
          });
          assert.equal(result.status, 403);
        }
        assert.equal(
          (
            await admin.request("/api/auth/login", "POST", {
              email: "admin@example.com",
              password: "TestPass123!",
            })
          ).status,
          200,
        );
      },
    );
    await t.test(
      "signup requires valid phone numbers and role-specific documents for both roles",
      async () => {
        for (const role of ["passenger", "driver"]) {
          for (const phone of [
            undefined,
            "",
            "+6012",
            "invalid",
            "1".repeat(16),
          ]) {
            assert.equal(
              (
                await stranger.request("/api/auth/register", "POST", {
                  ...registration(role, role + "-bad@example.com"),
                  phone_number: phone,
                })
              ).status,
              400,
            );
          }
        }
        assert.equal(
          (
            await stranger.request("/api/auth/register", "POST", {
              ...registration("driver", "nodoc@example.com"),
              license_doc: null,
            })
          ).status,
          400,
        );
        assert.equal(
          (
            await stranger.request("/api/auth/register", "POST", {
              ...registration("passenger", "bad-doc@example.com"),
              student_id_doc: "data:image/svg+xml;base64,PHN2Zz4=",
            })
          ).status,
          400,
        );
        for (const [c, role, email] of [
          [driver, "driver", "driver@example.com"],
          [driver2, "driver", "driver2@example.com"],
          [p1, "passenger", "p1@example.com"],
          [p2, "passenger", "p2@example.com"],
        ])
          assert.equal(
            (
              await c.request(
                "/api/auth/register",
                "POST",
                registration(role, email),
              )
            ).status,
            200,
          );
        const page = await fetch(base + "/register");
        const markup = await page.text();
        assert.match(markup, /Phone number \(required\)/);
        assert.match(markup, /Required for both passengers and drivers/);
      },
    );
    await t.test(
      "pending accounts cannot request or choose journeys; approval updates existing sessions",
      async () => {
        assert.equal((await request(p1)).status, 403);
        assert.equal((await driver.request("/api/bookings")).status, 403);
        const users = (await admin.request("/api/admin/users?tab=pending")).data
          .users;
        driverId = users.find((u) => u.email === "driver@example.com").id;
        driver2Id = users.find((u) => u.email === "driver2@example.com").id;
        p1Id = users.find((u) => u.email === "p1@example.com").id;
        p2Id = users.find((u) => u.email === "p2@example.com").id;
        for (const id of [driverId, driver2Id, p1Id, p2Id])
          assert.equal(
            (
              await admin.request("/api/admin/users", "PATCH", {
                userId: id,
                action: "approve",
              })
            ).status,
            200,
          );
        const pending = await fetch(base + "/pending", {
          headers: { Cookie: driver.cookie },
        });
        assert.equal(pending.status, 200);
        assert.ok(pending.url.endsWith("/driver"));
        assert.equal((await p1.request("/api/admin/users")).status, 403);
      },
    );
    await t.test(
      "only passengers create route requests and driver-published booking is disabled",
      async () => {
        assert.equal((await request(driver)).status, 403);
        assert.equal((await request(admin)).status, 403);
        assert.equal(
          (await driver.request("/api/rides", "POST", journey)).status,
          405,
        );
        assert.equal(
          (await p1.request("/api/rides/unknown/book", "POST", {})).status,
          405,
        );
        assert.equal((await p1.request("/api/rides")).status, 403);
        const result = await request(p1, {
          driver_id: driverId,
          passenger_id: p2Id,
          quoted_price: 1,
          status: "accepted",
        });
        assert.equal(result.status, 200);
        b1 = result.data.bookingId;
        const stored = (
          await db.execute({
            sql: "SELECT * FROM bookings WHERE id=?",
            args: [b1],
          })
        ).rows[0];
        assert.equal(stored.passenger_id, p1Id);
        assert.equal(stored.driver_id, null);
        assert.equal(stored.ride_id, null);
        assert.equal(stored.status, "pending");
        assert.equal(stored.quoted_price, null);
        assert.equal(stored.from_zone, "Main Campus");
        assert.equal(stored.to_zone, "Library");
        assert.equal((await request(p1)).status, 409);
        const second = await request(p2, { to_zone: "Hostel A" });
        assert.equal(second.status, 200);
        b2 = second.data.bookingId;
        assert.equal(
          Number(
            (await db.execute("SELECT COUNT(*) AS c FROM rides")).rows[0].c,
          ),
          0,
        );
      },
    );
    await t.test(
      "invalid route, past departure and payment details are rejected",
      async () => {
        for (const extra of [
          { from_zone: "unknown" },
          { to_zone: "Main Campus" },
          { departure_at: "invalid" },
          { departure_at: new Date(Date.now() - 60000).toISOString() },
          { payment_method: "card" },
        ])
          assert.equal((await request(p1, extra)).status, 400);
      },
    );
    await t.test(
      "drivers browse passengers by destination and Malaysia departure date",
      async () => {
        const requests = (await driver.request("/api/bookings")).data.bookings;
        assert.equal(requests.length, 2);
        const filtered = (
          await driver.request("/api/bookings?to=Library&from=Main%20Campus")
        ).data.bookings;
        assert.deepEqual(
          filtered.map((b) => b.id),
          [b1],
        );
        assert.equal(filtered[0].passenger_name, "p1");
        assert.equal(filtered[0].passenger_phone, "+60123456789");
        const day = new Date(new Date(future).getTime() + 8 * 3600000)
          .toISOString()
          .slice(0, 10);
        assert.equal(
          (await driver.request("/api/bookings?date=" + day)).data.bookings
            .length,
          2,
        );
        assert.equal(
          (await driver.request("/api/bookings?date=2000-01-01")).data.bookings
            .length,
          0,
        );
        assert.equal(
          (await driver.request("/api/bookings?mine=1")).data.bookings.length,
          0,
        );
        assert.equal(
          (await p1.request("/api/bookings?mine=1")).data.bookings.length,
          1,
        );
        assert.equal(
          (await driver.request("/api/notifications")).data.pendingRequests,
          2,
        );
      },
    );
    await t.test(
      "driver fare validation and booking ownership are enforced",
      async () => {
        assert.equal(
          (await patch(p1, b1, "accept", { price: 7.5 })).status,
          403,
        );
        assert.equal((await patch(p2, b1, "cancel")).status, 403);
        assert.equal((await patch(p1, b1, "confirm")).status, 409);
        assert.equal((await patch(driver, b1, "reject")).status, 403);
        for (const price of [undefined, 0, 0.000000001, -1, "5", 2.345, 100000])
          assert.equal(
            (await patch(driver, b1, "accept", { price })).status,
            400,
          );
        assert.equal((await patch(driver, b1, "unknown")).status, 400);
      },
    );
    await t.test(
      "two drivers choosing the same passenger produce exactly one price offer",
      async () => {
        const responses = await Promise.all([
          patch(driver, b1, "accept", { price: 7.5 }),
          patch(driver2, b1, "accept", { price: 8.25 }),
        ]);
        assert.deepEqual(responses.map((r) => r.status).sort(), [200, 403]);
        chosen = responses[0].status === 200 ? driver : driver2;
        other = chosen === driver ? driver2 : driver;
        chosenId = chosen === driver ? driverId : driver2Id;
        const row = (
          await db.execute({
            sql: "SELECT * FROM bookings WHERE id=?",
            args: [b1],
          })
        ).rows[0];
        assert.equal(row.driver_id, chosenId);
        assert.equal(row.status, "offered");
        assert.equal(Number(row.quoted_price), chosen === driver ? 750 : 825);
        assert.equal(
          (await other.request("/api/bookings")).data.bookings.some(
            (b) => b.id === b1,
          ),
          false,
        );
        assert.equal(
          (await other.request("/api/history")).data.history.some(
            (b) => b.id === b1,
          ),
          false,
        );
        assert.equal(
          (await chosen.request("/api/bookings?mine=1")).data.bookings[0].id,
          b1,
        );
        assert.equal(
          (await p1.request("/api/notifications")).data.priceOffers,
          1,
        );
        assert.equal(
          (await p1.request("/api/notifications")).data.acceptedBookings,
          0,
        );
        assert.equal((await patch(other, b1, "cancel")).status, 403);
        assert.equal(
          (await patch(chosen, b1, "accept", { price: 1 })).status,
          409,
        );
      },
    );
    await t.test(
      "only the requesting passenger can agree to the selected driver's price",
      async () => {
        assert.equal((await patch(chosen, b1, "confirm")).status, 403);
        assert.equal((await patch(p2, b1, "confirm")).status, 403);
        const previous = (await p1.request("/api/bookings")).data.bookings[0];
        assert.equal(previous.driver_phone, "+60123456789");
        assert.equal(
          (
            await p1.request("/api/bookings/" + b1, "PATCH", {
              action: "confirm",
            })
          ).status,
          409,
        );
        assert.equal(
          (
            await patch(p1, b1, "confirm", {
              quoted_price: previous.quoted_price + 1,
            })
          ).status,
          409,
        );
        assert.equal(
          (
            await patch(p1, b1, "confirm", {
              driver_id: chosen === driver ? driver2Id : driverId,
            })
          ).status,
          409,
        );
        assert.equal(
          (await patch(p1, b1, "confirm", { price: 0.01, driver_id: chosenId }))
            .status,
          200,
        );
        assert.equal((await patch(p1, b1, "confirm")).status, 409);
        const booked = (await p1.request("/api/history")).data.history.find(
          (b) => b.id === b1,
        );
        assert.equal(booked.status, "accepted");
        assert.equal(booked.quoted_price, previous.quoted_price);
        assert.equal(
          (await p1.request("/api/notifications")).data.acceptedBookings,
          1,
        );
        assert.equal((await patch(chosen, b1, "complete")).status, 400);
      },
    );
    await t.test(
      "declining an offer and withdrawing it let another driver choose the passenger",
      async () => {
        assert.equal(
          (await patch(driver, b2, "accept", { price: 5 })).status,
          200,
        );
        assert.equal((await patch(p2, b2, "decline")).status, 200);
        let row = (
          await db.execute({
            sql: "SELECT * FROM bookings WHERE id=?",
            args: [b2],
          })
        ).rows[0];
        assert.equal(row.status, "pending");
        assert.equal(row.driver_id, null);
        assert.equal(row.quoted_price, null);
        assert.equal((await patch(p2, b2, "decline")).status, 409);
        assert.equal(
          (await patch(driver2, b2, "accept", { price: 6 })).status,
          200,
        );
        assert.equal((await patch(driver, b2, "withdraw")).status, 403);
        const oldOffer = (await p2.request("/api/bookings")).data.bookings.find(
          (b) => b.id === b2,
        );
        assert.equal((await patch(driver2, b2, "withdraw")).status, 200);
        assert.equal(
          (await patch(driver, b2, "accept", { price: 7 })).status,
          200,
        );
        for (const action of ["confirm", "decline"])
          assert.equal(
            (
              await p2.request("/api/bookings/" + b2, "PATCH", {
                action,
                quoted_price: oldOffer.quoted_price,
                driver_id: oldOffer.driver_id,
              })
            ).status,
            409,
          );
        assert.equal((await patch(p2, b2, "confirm")).status, 200);
        row = (
          await db.execute({
            sql: "SELECT * FROM bookings WHERE id=?",
            args: [b2],
          })
        ).rows[0];
        assert.equal(row.driver_id, driverId);
        assert.equal(Number(row.quoted_price), 700);
      },
    );
    await t.test(
      "passenger cancellation and selected driver cancellation are scoped and repeat-safe",
      async () => {
        assert.equal((await patch(p1, b1, "cancel")).status, 200);
        assert.equal((await patch(p1, b1, "cancel")).status, 409);
        const retry = await request(p1);
        assert.equal(retry.status, 200);
        assert.notEqual(retry.data.bookingId, b1);
        assert.equal(
          (await patch(p1, retry.data.bookingId, "cancel")).status,
          200,
        );
        assert.equal((await patch(driver2, b2, "cancel")).status, 403);
        assert.equal((await patch(driver, b2, "cancel")).status, 200);
        assert.equal((await patch(driver, b2, "cancel")).status, 409);
      },
    );
    await t.test(
      "expired requests cannot be chosen and a booked journey completes only after departure",
      async () => {
        const expired = (await request(p2, { to_zone: "Hostel B" })).data
          .bookingId;
        await db.execute({
          sql: "UPDATE bookings SET departure_at=? WHERE id=?",
          args: [new Date(Date.now() - 1000).toISOString(), expired],
        });
        assert.equal(
          (await patch(driver, expired, "accept", { price: 5 })).status,
          400,
        );
        assert.equal(
          (await driver.request("/api/bookings")).data.bookings.some(
            (b) => b.id === expired,
          ),
          false,
        );
        const active = (await request(p2, { to_zone: "Sports Complex" })).data
          .bookingId;
        assert.equal(
          (await patch(driver, active, "accept", { price: 4 })).status,
          200,
        );
        assert.equal((await patch(p2, active, "confirm")).status, 200);
        await db.execute({
          sql: "UPDATE bookings SET departure_at=? WHERE id=?",
          args: [new Date(Date.now() - 1000).toISOString(), active],
        });
        assert.equal((await patch(driver2, active, "complete")).status, 403);
        assert.equal((await patch(p2, active, "complete")).status, 403);
        assert.equal((await patch(driver, active, "complete")).status, 200);
        assert.equal((await patch(driver, active, "complete")).status, 409);
        assert.equal(
          (await driver.request("/api/history")).data.history.find(
            (b) => b.id === active,
          ).status,
          "completed",
        );
      },
    );
    await t.test(
      "phone numbers can be edited without changing another account",
      async () => {
        assert.equal(
          (
            await stranger.request("/api/auth/me", "PATCH", {
              phone_number: "+60198765432",
            })
          ).status,
          401,
        );
        assert.equal(
          (
            await p1.request("/api/auth/me", "PATCH", {
              phone_number: "invalid",
            })
          ).status,
          400,
        );
        assert.equal(
          (
            await p1.request("/api/auth/me", "PATCH", {
              phone_number: "+60 12-987 6543",
            })
          ).status,
          200,
        );
        assert.equal(
          (await p1.request("/api/auth/me")).data.user.phone_number,
          "+60129876543",
        );
        assert.equal(
          (await p2.request("/api/auth/me")).data.user.phone_number,
          "+60123456789",
        );
        assert.equal(
          (
            await admin.request("/api/admin/users?tab=approved")
          ).data.users.find((u) => u.id === p1Id).phone_number,
          "+60129876543",
        );
      },
    );
    await t.test(
      "unassigned requests appear in history and CSV; logs and notifications follow the new flow",
      async () => {
        const fresh = (await request(p1, { to_zone: "Town / Off-Campus" })).data
          .bookingId;
        assert.equal(
          (await admin.request("/api/history")).data.history.some(
            (b) => b.id === fresh,
          ),
          true,
        );
        assert.equal(
          (await p1.request("/api/history")).data.history.find(
            (b) => b.id === fresh,
          ).driver_name,
          null,
        );
        const csv = await admin.request("/api/reports/history");
        assert.equal(csv.status, 200);
        assert.match(csv.data, /fare_rm/);
        assert.match(csv.data, /Town \/ Off-Campus/);
        assert.equal(
          (await other.request("/api/reports/history")).data.includes(fresh),
          false,
        );
        assert.equal((await p2.request("/api/reports/logs")).status, 403);
        const logs = (await admin.request("/api/admin/logs")).data.logs;
        assert.ok(logs.some((l) => l.action === "REQUEST_BOOKING"));
        assert.ok(logs.some((l) => l.action === "CONFIRM_BOOKING"));
      },
    );
    await t.test(
      "revoked approval blocks requests and permits document resubmission",
      async () => {
        assert.equal(
          (
            await admin.request("/api/admin/users", "PATCH", {
              userId: p1Id,
              action: "reject",
            })
          ).status,
          200,
        );
        assert.equal(
          (await request(p1, { to_zone: "Faculty of Business" })).status,
          403,
        );
        assert.equal(
          (
            await p1.request("/api/auth/resubmit", "POST", {
              student_id_doc: doc,
            })
          ).status,
          200,
        );
        assert.equal(
          (await p1.request("/api/auth/me")).data.user.status,
          "pending",
        );
      },
    );
  },
);
