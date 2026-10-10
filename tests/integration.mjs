import { passportPhoto } from "./photo-fixtures.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import { compare, hash } from "bcryptjs";
import { createServer } from "node:net";
import { createServer as httpServer } from "node:http";
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

test(
  "GrabStudent complete MVP journeys and concurrency",
  { timeout: 180000 },
  async (t) => {
    const savedAuthSecret = process.env.AUTH_SECRET;
    process.env.AUTH_SECRET = "integration-only-32-character-secret-value";
    t.after(() => {
      if (savedAuthSecret === undefined) delete process.env.AUTH_SECRET;
      else process.env.AUTH_SECRET = savedAuthSecret;
    });
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
    const geocoder = httpServer((request, response) => {
      const parameters = new URL(request.url, "http://localhost");
      if (parameters.searchParams.get("q") === "Unavailable") {
        response.writeHead(503).end("Unavailable");
        return;
      }
      response.setHeader("Content-Type", "application/json");
      response.end(
        JSON.stringify({
          features: [
            {
              geometry: { coordinates: [101.6865, 3.1341] },
              properties: {
                name: "KL Sentral",
                street: "Jalan Stesen Sentral",
                city: "Kuala Lumpur",
                country: "Malaysia",
              },
            },
          ],
        }),
      );
    });
    await new Promise((resolve) => geocoder.listen(0, "127.0.0.1", resolve));
    t.after(() => new Promise((resolve) => geocoder.close(resolve)));
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
          CRON_SECRET: "integration-only-cron-secret-32-characters",
          BOOKING_RETENTION_MODE: "",
          NEXT_PUBLIC_DEMO_MODE: "false",
          GRABSTUDENT_DIST_DIR: ".next-test",
          GEOCODING_BASE_URL: `http://127.0.0.1:${geocoder.address().port}`,
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
    const photo = passportPhoto();
    const registration = (role, email) => ({
      name: email.split("@")[0],
      email,
      phone_number: "+60123456789",
      password: "TestPass123!",
      student_number: email,
      role,
      student_id_doc: doc,
      license_doc: role === "driver" ? doc : null,
      profile_photo: role === "driver" ? photo : null,
      ...(role === "driver"
        ? {
            car_colour: "White",
            car_type: "Perodua Myvi",
            car_plate: "ABC 1234",
          }
        : {}),
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
        // Suspense can stream a meta redirect after sending HTTP 200.
        assert.ok(
          pending.url.endsWith("/driver") ||
            /http-equiv="refresh"[^>]*url=\/driver/.test(await pending.text()),
        );
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
        assert.equal(stored.passenger_count, 1);
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
          { from_zone: " " },
          { from_zone: 123 },
          { to_zone: "x".repeat(161) },
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
      "driver signup requires a photo and vehicle; passenger photos remain optional",
      async () => {
        for (const extra of [
          { profile_photo: null },
          { car_plate: "" },
          { car_type: "" },
          { car_colour: "" },
          { profile_photo: "data:application/pdf;base64,JVBERi0=" },
          { profile_photo: "data:image/jpeg;base64," + "A".repeat(400000) },
        ]) {
          assert.equal(
            (
              await stranger.request("/api/auth/register", "POST", {
                ...registration("driver", "profile-bad@example.com"),
                ...extra,
              })
            ).status,
            400,
          );
        }
        const me = (await driver.request("/api/auth/me")).data.user;
        assert.equal(me.car_plate, "ABC 1234");
        assert.equal(me.profile_photo, photo);
        assert.equal(
          (
            await driver.request("/api/auth/me", "PATCH", {
              profile_photo: null,
            })
          ).status,
          400,
        );
        assert.equal(
          (await p1.request("/api/auth/me", "PATCH", { car_plate: "ZZZ 999" }))
            .status,
          400,
        );
        assert.equal(
          (await p1.request("/api/auth/me", "PATCH", { profile_photo: photo }))
            .status,
          200,
        );
        assert.equal(
          (await p1.request("/api/auth/me", "PATCH", { profile_photo: null }))
            .status,
          200,
        );
        assert.equal(
          (
            await driver.request("/api/auth/me", "PATCH", {
              car_colour: "Blue",
              car_type: "Proton Saga",
              car_plate: "wxy 4321",
            })
          ).status,
          200,
        );
        assert.equal(
          (await driver.request("/api/auth/me")).data.user.car_plate,
          "WXY 4321",
        );
        assert.equal(
          (await driver2.request("/api/auth/me")).data.user.car_plate,
          "ABC 1234",
        );
      },
    );
    await t.test(
      "first-visit guidance is saved per account and cannot be reset",
      async () => {
        assert.equal(
          (await p1.request("/api/auth/me")).data.user.onboarding_seen_at,
          null,
        );
        assert.equal(
          (await p1.request("/api/auth/me", "PATCH", { onboarding_seen: true }))
            .status,
          200,
        );
        const seen = (await p1.request("/api/auth/me")).data.user
          .onboarding_seen_at;
        assert.ok(seen);
        await delay(20);
        assert.equal(
          (await p1.request("/api/auth/me", "PATCH", { onboarding_seen: true }))
            .status,
          200,
        );
        assert.equal(
          (await p1.request("/api/auth/me")).data.user.onboarding_seen_at,
          seen,
        );
        assert.equal(
          (
            await p1.request("/api/auth/me", "PATCH", {
              onboarding_seen: false,
            })
          ).status,
          400,
        );
        assert.equal(
          (await driver.request("/api/auth/me")).data.user.onboarding_seen_at,
          null,
        );
      },
    );
    await t.test(
      "pickup remarks, driver arrival and passenger acknowledgment are scoped and repeat-safe",
      async () => {
        const created = await request(p1, {
          to_zone: "Faculty of Business",
          pickup_note: "  Main gate, next to security  ",
        });
        assert.equal(created.status, 200);
        const id = created.data.bookingId;
        assert.equal(
          (
            await request(p2, {
              to_zone: "Faculty of Business",
              pickup_note: "x".repeat(301),
            })
          ).status,
          400,
        );
        assert.equal((await patch(p1, id, "arrive")).status, 403);
        assert.equal((await patch(driver, id, "arrive")).status, 403);
        assert.equal(
          (await patch(p2, id, "remark", { pickup_note: "Elsewhere" })).status,
          403,
        );
        assert.equal(
          (await patch(p1, id, "remark", { pickup_note: { bad: true } }))
            .status,
          400,
        );
        assert.equal(
          (
            await patch(p1, id, "remark", {
              pickup_note: " Library side entrance ",
            })
          ).status,
          200,
        );
        assert.equal(
          (await driver.request("/api/bookings")).data.bookings.find(
            (b) => b.id === id,
          ).pickup_note,
          "Library side entrance",
        );
        assert.equal(
          (await patch(driver, id, "accept", { price: 8 })).status,
          200,
        );
        assert.equal((await patch(driver, id, "arrive")).status, 409);
        assert.equal((await patch(p1, id, "confirm")).status, 200);
        assert.equal((await patch(driver2, id, "arrive")).status, 403);
        assert.equal(
          (await patch(driver, id, "remark", { pickup_note: "bad" })).status,
          403,
        );
        assert.equal((await patch(p1, id, "acknowledge")).status, 409);
        const walletBeforeArrival = (await driver.request("/api/wallet")).data;
        const responses = await Promise.all([
          patch(driver, id, "arrive"),
          patch(driver, id, "arrive"),
        ]);
        assert.deepEqual(
          responses.map((r) => r.status),
          [200, 200],
        );
        const booking = (await p1.request("/api/bookings")).data.bookings.find(
          (b) => b.id === id,
        );
        assert.ok(booking.arrived_at);
        const walletAfterArrival = (await driver.request("/api/wallet")).data;
        for (const period of ["daily", "weekly", "monthly"]) {
          assert.equal(
            walletAfterArrival.periods[period].total,
            walletBeforeArrival.periods[period].total + 800,
          );
          assert.equal(
            walletAfterArrival.periods[period].journeys,
            walletBeforeArrival.periods[period].journeys + 1,
          );
        }
        assert.equal(
          walletAfterArrival.recent.find((item) => item.id === id).recorded_at,
          booking.arrived_at,
        );
        assert.equal(booking.car_plate, "WXY 4321");
        assert.equal(booking.driver_photo, photo);
        assert.ok(
          (await p1.request("/api/notifications")).data.driverArrivals >= 1,
        );
        const audit = await db.execute({
          sql: "SELECT COUNT(*) as count FROM audit_logs WHERE action='ARRIVE_BOOKING' AND details LIKE ?",
          args: ["%" + id],
        });
        assert.equal(Number(audit.rows[0].count), 1);
        assert.equal((await patch(driver, id, "acknowledge")).status, 403);
        assert.equal((await patch(p2, id, "acknowledge")).status, 403);
        assert.equal((await patch(p1, id, "acknowledge")).status, 200);
        const ack = (await p1.request("/api/bookings")).data.bookings.find(
          (b) => b.id === id,
        ).arrival_acknowledged_at;
        assert.ok(ack);
        assert.equal((await patch(p1, id, "acknowledge")).status, 200);
        assert.equal(
          (await p1.request("/api/bookings")).data.bookings.find(
            (b) => b.id === id,
          ).arrival_acknowledged_at,
          ack,
        );
        assert.deepEqual(
          (await driver.request("/api/wallet")).data.periods,
          walletAfterArrival.periods,
        );
        assert.equal((await patch(p1, id, "cancel")).status, 200);
        assert.deepEqual(
          (await driver.request("/api/wallet")).data.periods,
          walletBeforeArrival.periods,
        );
        assert.equal((await patch(driver, id, "arrive")).status, 409);
        // An older driver can view existing bookings but must complete their profile before offering again.
        await db.execute({
          sql: "UPDATE users SET profile_photo=NULL WHERE id=?",
          args: [driver2Id],
        });
        const fresh = (await request(p2, { to_zone: "Faculty of Business" }))
          .data.bookingId;
        assert.equal(
          (await patch(driver2, fresh, "accept", { price: 4 })).status,
          400,
        );
        await db.execute({
          sql: "UPDATE users SET profile_photo=? WHERE id=?",
          args: [doc, driver2Id],
        });
      },
    );
    await t.test(
      "wallet records each arrival once by arrival date, keeps historical completed fares and excludes unarrived bookings",
      async () => {
        assert.equal((await stranger.request("/api/wallet")).status, 401);
        assert.equal((await p1.request("/api/wallet")).status, 403);
        assert.equal((await admin.request("/api/wallet")).status, 403);
        const previous = (await driver.request("/api/wallet")).data;
        const departure = new Date(Date.now() - 60000).toISOString();
        const arrival = new Date().toISOString();
        const oldArrival = new Date(Date.now() - 40 * 86400000).toISOString();
        for (const [id, status, price, method, driverOwner, date, arrived] of [
          [
            "wallet-cash",
            "accepted",
            1000,
            "cash",
            driverId,
            departure,
            arrival,
          ],
          ["wallet-qr", "completed", 500, "qr", driverId, arrival, null],
          [
            "wallet-cancel",
            "cancelled",
            9000,
            "cash",
            driverId,
            departure,
            arrival,
          ],
          [
            "wallet-offer",
            "offered",
            9000,
            "cash",
            driverId,
            departure,
            arrival,
          ],
          ["wallet-future", "accepted", 9000, "cash", driverId, future, null],
          [
            "wallet-other",
            "accepted",
            9000,
            "cash",
            driver2Id,
            departure,
            arrival,
          ],
          [
            "wallet-unarrived",
            "accepted",
            9000,
            "cash",
            driverId,
            departure,
            null,
          ],
          [
            "wallet-early-arrival",
            "accepted",
            250,
            "cash",
            driverId,
            future,
            arrival,
          ],
          [
            "wallet-old-arrival",
            "accepted",
            400,
            "cash",
            driverId,
            arrival,
            oldArrival,
          ],
          [
            "wallet-invalid-future-arrival",
            "accepted",
            9000,
            "cash",
            driverId,
            departure,
            future,
          ],
        ])
          await db.execute({
            sql: "INSERT INTO bookings (id,driver_id,passenger_id,from_zone,to_zone,departure_at,status,quoted_price,payment_method,arrived_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
            args: [
              id,
              driverOwner,
              p1Id,
              "Main Campus",
              "Library",
              date,
              status,
              price,
              method,
              arrived,
              now,
              now,
            ],
          });
        const result = (await driver.request("/api/wallet")).data;
        for (const period of ["daily", "weekly", "monthly"]) {
          assert.equal(
            result.periods[period].total,
            previous.periods[period].total + 1750,
          );
          assert.equal(
            result.periods[period].cash,
            previous.periods[period].cash + 1250,
          );
          assert.equal(
            result.periods[period].qr,
            previous.periods[period].qr + 500,
          );
          assert.equal(
            result.periods[period].journeys,
            previous.periods[period].journeys + 3,
          );
        }
        assert.ok(result.recent.some((b) => b.id === "wallet-cash"));
        assert.ok(result.recent.some((b) => b.id === "wallet-early-arrival"));
        assert.equal(
          result.recent.find((b) => b.id === "wallet-cash").recorded_at,
          arrival,
        );
        assert.ok(
          !result.recent.some((b) =>
            [
              "wallet-cancel",
              "wallet-offer",
              "wallet-future",
              "wallet-other",
              "wallet-unarrived",
              "wallet-invalid-future-arrival",
            ].includes(b.id),
          ),
        );
        assert.equal(
          (await patch(driver, "wallet-cash", "arrive")).status,
          200,
        );
        assert.equal(
          (await patch(driver, "wallet-cash", "complete")).status,
          200,
        );
        const afterCompletion = (await driver.request("/api/wallet")).data;
        assert.deepEqual(afterCompletion.periods, result.periods);
        assert.equal(
          afterCompletion.recent.find((b) => b.id === "wallet-cash")
            .recorded_at,
          arrival,
        );
      },
    );
    await t.test(
      "booking and history filters keep newest requests first with stable ties",
      async () => {
        const entries = [
          ["sort-old", "2020-05-01T00:00:00.000Z", "2099-05-01T12:00:00.000Z"],
          [
            "sort-tie-a",
            "2020-05-02T00:00:00.000Z",
            "2099-05-01T11:00:00.000Z",
          ],
          [
            "sort-tie-z",
            "2020-05-02T00:00:00.000Z",
            "2099-05-01T10:00:00.000Z",
          ],
          ["sort-new", "2020-05-03T00:00:00.000Z", "2099-05-01T09:00:00.000Z"],
        ];
        const expected = ["sort-new", "sort-tie-z", "sort-tie-a", "sort-old"];
        try {
          for (const [id, created, departure] of entries)
            await db.execute({
              sql: "INSERT INTO bookings (id,passenger_id,from_zone,to_zone,departure_at,status,payment_method,created_at,updated_at) VALUES (?,?,'Sort pickup','Sort destination',?,'pending','cash',?,?)",
              args: [id, p1Id, departure, created, created],
            });
          const sortedIds = (rows) =>
            rows.filter((b) => b.id.startsWith("sort-")).map((b) => b.id);
          for (const query of [
            "",
            "?from=Sort%20pickup",
            "?to=Sort%20destination",
            "?date=2099-05-01",
            "?from=Sort&to=destination&date=2099-05-01",
          ])
            assert.deepEqual(
              sortedIds(
                (await driver.request("/api/bookings" + query)).data.bookings,
              ),
              expected,
            );
          assert.deepEqual(
            sortedIds((await p1.request("/api/bookings")).data.bookings),
            expected,
          );
          for (const account of [p1, admin]) {
            const history = (await account.request("/api/history")).data
              .history;
            assert.deepEqual(sortedIds(history), expected);
            assert.deepEqual(
              sortedIds(history.filter((b) => b.status === "pending")),
              expected,
            );
            const csv = (await account.request("/api/reports/history")).data;
            assert.deepEqual(
              csv
                .split("\n")
                .filter((line) => line.startsWith("sort-"))
                .map((line) => line.split(",")[0]),
              expected,
            );
          }
          for (const [id] of entries)
            await db.execute({
              sql: "UPDATE bookings SET driver_id=?,status='accepted',quoted_price=500 WHERE id=?",
              args: [driverId, id],
            });
          assert.deepEqual(
            sortedIds(
              (await driver.request("/api/bookings?mine=1")).data.bookings,
            ),
            expected,
          );
          assert.deepEqual(
            sortedIds((await driver.request("/api/history")).data.history),
            expected,
          );
        } finally {
          for (const [id] of entries)
            await db.execute({
              sql: "DELETE FROM bookings WHERE id=?",
              args: [id],
            });
        }
      },
    );

    await t.test(
      "latest booking includes closed orders, stable ties and only the owning passenger",
      async () => {
        const ids = ["latest-old", "latest-a", "latest-z", "latest-other"];
        try {
          for (const [id, owner, status, created] of [
            [ids[0], p1Id, "accepted", "2098-01-01T00:00:00Z"],
            [ids[1], p1Id, "pending", "2098-01-02T00:00:00Z"],
            [ids[2], p1Id, "cancelled", "2098-01-02T00:00:00Z"],
            [ids[3], p2Id, "pending", "2099-01-01T00:00:00Z"],
          ])
            await db.execute({
              sql: "INSERT INTO bookings (id,passenger_id,from_zone,to_zone,departure_at,status,payment_method,created_at,updated_at) VALUES (?,?,'Latest pickup','Latest dropoff',? ,?,'cash',?,?)",
              args: [id, owner, future, status, created, created],
            });
          assert.deepEqual(
            (await p1.request("/api/bookings?latest=1")).data.bookings.map(
              (b) => b.id,
            ),
            ["latest-z"],
          );
          assert.deepEqual(
            (await p2.request("/api/bookings?latest=1")).data.bookings.map(
              (b) => b.id,
            ),
            ["latest-other"],
          );
          await db.execute(
            "UPDATE bookings SET status='completed' WHERE id='latest-z'",
          );
          assert.equal(
            (await p1.request("/api/bookings?latest=1")).data.bookings[0]
              .status,
            "completed",
          );
          assert.equal(
            (await stranger.request("/api/bookings?latest=1")).status,
            401,
          );
        } finally {
          for (const id of ids)
            await db.execute({
              sql: "DELETE FROM bookings WHERE id=?",
              args: [id],
            });
        }
      },
    );
    await t.test(
      "driver latest booking returns one owned order including closed statuses without changing active lists",
      async () => {
        const ids = [
          "driver-latest-old",
          "driver-latest-a",
          "driver-latest-z",
          "driver-latest-other",
          "driver-latest-unassigned",
        ];
        try {
          for (const [id, assignedDriver, status, created] of [
            [ids[0], driverId, "offered", "2098-01-01T00:00:00Z"],
            [ids[1], driverId, "accepted", "2098-01-02T00:00:00Z"],
            [ids[2], driverId, "cancelled", "2098-01-02T00:00:00Z"],
            [ids[3], driver2Id, "completed", "2099-01-01T00:00:00Z"],
            [ids[4], null, "pending", "2099-01-02T00:00:00Z"],
          ])
            await db.execute({
              sql: "INSERT INTO bookings (id,passenger_id,driver_id,from_zone,to_zone,departure_at,status,payment_method,quoted_price,created_at,updated_at) VALUES (?,?,?,'Driver latest pickup','Driver latest dropoff',?,?,'cash',500,?,?)",
              args: [
                id,
                p1Id,
                assignedDriver,
                future,
                status,
                created,
                created,
              ],
            });
          const latest = await driver.request("/api/bookings?mine=1&latest=1");
          assert.equal(latest.status, 200);
          assert.deepEqual(
            latest.data.bookings.map((b) => b.id),
            [ids[2]],
          );
          assert.equal(latest.data.bookings[0].status, "cancelled");
          assert.deepEqual(
            (
              await driver2.request("/api/bookings?mine=1&latest=1")
            ).data.bookings.map((b) => b.id),
            [ids[3]],
          );
          await db.execute({
            sql: "UPDATE bookings SET updated_at='2100-01-01T00:00:00Z' WHERE id=?",
            args: [ids[0]],
          });
          await db.execute({
            sql: "UPDATE bookings SET status='completed' WHERE id=?",
            args: [ids[2]],
          });
          const completed = (
            await driver.request("/api/bookings?mine=1&latest=1")
          ).data.bookings;
          assert.deepEqual(
            completed.map((b) => b.id),
            [ids[2]],
          );
          assert.equal(completed[0].status, "completed");
          assert.deepEqual(
            (await driver.request("/api/bookings?mine=1")).data.bookings
              .filter((b) => ids.includes(b.id))
              .map((b) => b.id),
            [ids[1], ids[0]],
          );
          const available = (await driver.request("/api/bookings?latest=1"))
            .data.bookings;
          assert.ok(available.some((b) => b.id === ids[4]));
          assert.ok(available.every((b) => b.status === "pending"));
          assert.ok(!available.some((b) => b.id === ids[2] || b.id === ids[3]));
          assert.equal(
            (await stranger.request("/api/bookings?mine=1&latest=1")).status,
            401,
          );
        } finally {
          for (const id of ids)
            await db.execute({
              sql: "DELETE FROM bookings WHERE id=?",
              args: [id],
            });
        }
      },
    );
    await t.test(
      "retired rating APIs cannot alter bookings or wallet totals",
      async () => {
        const created = await request(p1, {
          from_zone: "No ratings pickup",
          to_zone: "No ratings destination",
        });
        assert.equal(created.status, 200);
        const id = created.data.bookingId;
        assert.equal(
          (await patch(driver, id, "accept", { price: 7 })).status,
          200,
        );
        assert.equal((await patch(p1, id, "confirm")).status, 200);
        assert.equal((await patch(driver, id, "arrive")).status, 200);
        const before = (
          await db.execute({
            sql: "SELECT * FROM bookings WHERE id=?",
            args: [id],
          })
        ).rows[0];
        const wallet = (await driver.request("/api/wallet")).data.periods;
        assert.equal((await driver.request("/api/ratings")).status, 404);
        assert.equal(
          (
            await p1.request("/api/bookings/" + id + "/rating", "POST", {
              score: 5,
              feedback: "Removed",
              confirm_finished: true,
            })
          ).status,
          404,
        );
        assert.deepEqual(
          (
            await db.execute({
              sql: "SELECT * FROM bookings WHERE id=?",
              args: [id],
            })
          ).rows[0],
          before,
        );
        assert.deepEqual(
          (await driver.request("/api/wallet")).data.periods,
          wallet,
        );
        for (const account of [p1, driver, admin]) {
          const row = (await account.request("/api/history")).data.history.find(
            (row) => row.id === id,
          );
          for (const key of [
            "rating_score",
            "rating_feedback",
            "rated_at",
            "driver_rating_average",
            "driver_rating_count",
          ])
            assert.equal(key in row, false);
        }
        assert.equal((await patch(p1, id, "cancel")).status, 200);
      },
    );
    await t.test(
      "party size is validated, visible to drivers and preserved through fare agreement and arrival",
      async () => {
        const details = {
          from_zone: "Group pickup",
          to_zone: "Group destination",
          passenger_count: 4,
        };
        for (const count of [null, "3", 0, -1, 5, 1.5, true, {}, []])
          assert.equal(
            (await request(p1, { ...details, passenger_count: count })).status,
            400,
          );
        assert.equal((await request(driver, details)).status, 403);
        const created = await request(p1, details);
        assert.equal(created.status, 200);
        const id = created.data.bookingId;
        assert.equal(
          (await driver.request("/api/bookings")).data.bookings.find(
            (b) => b.id === id,
          ).passenger_count,
          4,
        );
        assert.equal(
          (await request(p1, { ...details, passenger_count: 2 })).status,
          409,
          "changing the group size does not create a duplicate active journey",
        );
        assert.equal(
          (await patch(driver, id, "accept", { price: 20, passenger_count: 1 }))
            .status,
          200,
        );
        const offered = (await p1.request("/api/bookings")).data.bookings.find(
          (b) => b.id === id,
        );
        assert.equal(offered.passenger_count, 4);
        assert.equal(
          offered.quoted_price,
          2000,
          "the fare is the group total, not multiplied by party size",
        );
        assert.equal(
          (await patch(p1, id, "confirm", { passenger_count: 2 })).status,
          200,
        );
        assert.equal(
          (await driver.request("/api/bookings?mine=1")).data.bookings.find(
            (b) => b.id === id,
          ).passenger_count,
          4,
        );
        assert.equal((await patch(driver, id, "arrive")).status, 200);
        const history = (
          await driver.request("/api/history")
        ).data.history.find((b) => b.id === id);
        assert.equal(history.passenger_count, 4);
        const recorded = (await driver.request("/api/wallet")).data.recent.find(
          (b) => b.id === id,
        );
        assert.equal(recorded.quoted_price, 2000);
        const report = await driver.request("/api/reports/history");
        const [header, ...rows] = report.data.split("\n");
        const column = header.split(",").indexOf("passenger_count");
        assert.ok(column >= 0);
        assert.equal(
          rows.find((line) => line.startsWith(id + ",")).split(",")[column],
          "4",
        );
        assert.equal((await patch(p1, id, "cancel")).status, 200);
        for (const count of [1, 2, 3]) {
          const next = await request(p1, {
            ...details,
            passenger_count: count,
          });
          assert.equal(next.status, 200);
          assert.equal(
            (await p1.request("/api/bookings")).data.bookings.find(
              (b) => b.id === next.data.bookingId,
            ).passenger_count,
            count,
          );
          assert.equal(
            (await patch(p1, next.data.bookingId, "cancel")).status,
            200,
          );
        }
      },
    );
    await t.test(
      "address lookup is private, validated, rate limited and preserves exact map points",
      async () => {
        const search = { action: "search", query: "KL Sentral" };
        assert.equal(
          (await stranger.request("/api/locations", "POST", search)).status,
          401,
        );
        assert.equal(
          (await driver.request("/api/locations", "POST", search)).status,
          403,
        );
        assert.equal(
          (await admin.request("/api/locations", "POST", search)).status,
          403,
        );
        for (const invalid of [
          null,
          { action: "other" },
          { ...search, query: "x" },
          { ...search, query: "bad\naddress" },
          { ...search, nearby: { lat: 3, lng: "bad" } },
          { action: "reverse" },
          { action: "reverse", lat: 90, lng: 101 },
        ])
          assert.equal(
            (await p1.request("/api/locations", "POST", invalid)).status,
            400,
          );
        const found = await p1.request("/api/locations", "POST", search);
        assert.equal(found.status, 200);
        assert.deepEqual(found.data.locations, [
          {
            address: "KL Sentral, Jalan Stesen Sentral, Kuala Lumpur, Malaysia",
            lat: 3.1341,
            lng: 101.6865,
          },
        ]);
        assert.equal(
          (await p1.request("/api/locations", "POST", search)).status,
          429,
        );
        await delay(850);
        const reverse = await p1.request("/api/locations", "POST", {
          action: "reverse",
          lat: 3.1391234,
          lng: 101.6869876,
        });
        assert.equal(reverse.status, 200);
        assert.equal(reverse.data.locations[0].lat, 3.139123);
        assert.equal(reverse.data.locations[0].lng, 101.686988);
        await delay(850);
        const unavailable = await p1.request("/api/locations", "POST", {
          action: "search",
          query: "Unavailable",
        });
        assert.equal(unavailable.status, 503);
        assert.match(unavailable.data.error, /temporarily unavailable/);
      },
    );
    await t.test(
      "passengers choose flexible place names and valid map pins; driver filters and history preserve them",
      async () => {
        const locations = {
          from_zone: "  Library side entrance  ",
          to_zone: "Apartment lobby, Jalan Melati",
          pickup_lat: 3.1391234,
          pickup_lng: 101.6869876,
          destination_lat: 3.1574567,
          destination_lng: 101.7112345,
        };
        for (const invalid of [
          { pickup_lat: 91 },
          { pickup_lng: -181 },
          { pickup_lat: "3.14" },
          { pickup_lng: null },
          { destination_lng: "101.7" },
          { destination_lat: null },
          {
            destination_lat: locations.pickup_lat,
            destination_lng: locations.pickup_lng,
          },
          { from_zone: "bad\nlocation" },
        ])
          assert.equal(
            (await request(p1, { ...locations, ...invalid })).status,
            400,
          );
        assert.equal((await request(driver, locations)).status, 403);
        const created = await request(p1, locations);
        assert.equal(created.status, 200);
        const id = created.data.bookingId;
        const saved = (await p1.request("/api/bookings")).data.bookings.find(
          (item) => item.id === id,
        );
        assert.equal(saved.from_zone, "Library side entrance");
        assert.equal(saved.to_zone, locations.to_zone);
        assert.equal(saved.pickup_lat, 3.139123);
        assert.equal(saved.pickup_lng, 101.686988);
        assert.equal(saved.destination_lat, 3.157457);
        assert.equal(saved.destination_lng, 101.711235);
        assert.equal(
          (
            await request(p1, {
              ...locations,
              from_zone: "library SIDE entrance",
            })
          ).status,
          409,
        );
        assert.ok(
          (
            await driver.request("/api/bookings?from=SIDE%20ENTRANCE&to=melati")
          ).data.bookings.some((item) => item.id === id),
        );
        assert.equal(
          (await driver.request("/api/bookings?from=%25")).data.bookings.length,
          0,
        );
        assert.ok(
          !(await p2.request("/api/bookings")).data.bookings.some(
            (item) => item.id === id,
          ),
        );
        assert.equal(
          (await patch(driver, id, "accept", { price: 12.5 })).status,
          200,
        );
        assert.equal((await patch(p1, id, "confirm")).status, 200);
        const assigned = (
          await driver.request("/api/bookings?mine=1")
        ).data.bookings.find((item) => item.id === id);
        assert.equal(assigned.pickup_lat, saved.pickup_lat);
        assert.equal(assigned.destination_lng, saved.destination_lng);
        assert.equal(
          (await patch(p2, id, "remark", { pickup_note: "Wrong location" }))
            .status,
          403,
        );
        const history = (await p1.request("/api/history")).data.history.find(
          (item) => item.id === id,
        );
        assert.equal(history.pickup_lng, saved.pickup_lng);
        assert.equal(history.destination_lat, saved.destination_lat);
        assert.equal((await patch(p1, id, "cancel")).status, 200);
        const sameName = await request(p1, {
          ...locations,
          from_zone: "Library",
          to_zone: "Library",
        });
        assert.equal(sameName.status, 200);
        assert.equal(
          (await patch(p1, sameName.data.bookingId, "cancel")).status,
          200,
        );
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
              rejection_reason: "Please upload a clearer Student ID.",
            })
          ).status,
          200,
        );
        assert.equal(
          (
            await p1.request("/api/locations", "POST", {
              action: "search",
              query: "Library",
            })
          ).status,
          403,
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
    await t.test(
      "rejection reasons are mandatory, private, persisted and cleared on resubmission",
      async () => {
        const account = client();
        assert.equal(
          (
            await account.request(
              "/api/auth/register",
              "POST",
              registration("passenger", "reason-test@example.com"),
            )
          ).status,
          200,
        );
        const user = (await account.request("/api/auth/me")).data.user;
        const decide = (extra = {}) =>
          admin.request("/api/admin/users", "PATCH", {
            userId: user.id,
            action: "reject",
            ...extra,
          });
        for (const reason of [undefined, "", "   ", "x".repeat(1001), 42])
          assert.equal(
            (await decide({ rejection_reason: reason })).status,
            400,
          );
        assert.equal(
          (await account.request("/api/auth/me")).data.user.status,
          "pending",
        );
        assert.equal(
          (
            await decide({
              rejection_reason: "Please upload a clear Student ID.",
              expectedUpdatedAt: "stale",
            })
          ).status,
          409,
        );
        const reason =
          "Please upload a clear Student ID.\nYour name is not readable.";
        assert.equal(
          (await decide({ rejection_reason: "  " + reason + "  " })).status,
          200,
        );
        const rejected = (await account.request("/api/auth/me")).data.user;
        assert.equal(rejected.status, "rejected");
        assert.equal(rejected.rejection_reason, reason);
        assert.equal(
          (
            await db.execute({
              sql: "SELECT rejection_reason FROM users WHERE id=?",
              args: [user.id],
            })
          ).rows[0].rejection_reason,
          reason,
        );
        assert.notEqual(
          (await p2.request("/api/auth/me")).data.user.rejection_reason,
          reason,
        );
        const pendingPage = await fetch(base + "/pending", {
          headers: { Cookie: account.cookie },
        });
        assert.ok(
          (await pendingPage.text()).includes("Your name is not readable."),
        );
        assert.equal(
          (await decide({ rejection_reason: "Changed" })).status,
          409,
        );
        assert.equal(
          (
            await account.request("/api/auth/resubmit", "POST", {
              student_id_doc: doc,
            })
          ).status,
          200,
        );
        const resubmitted = (await account.request("/api/auth/me")).data.user;
        assert.equal(resubmitted.status, "pending");
        assert.equal(resubmitted.rejection_reason, null);
        assert.equal(
          (
            await admin.request("/api/admin/users", "PATCH", {
              userId: user.id,
              action: "edit",
              changes: { status: "rejected" },
            })
          ).status,
          400,
        );
        assert.equal(
          (
            await admin.request("/api/admin/users", "PATCH", {
              userId: user.id,
              action: "edit",
              changes: {
                status: "rejected",
                rejection_reason: "Use your own profile photo.",
              },
            })
          ).status,
          200,
        );
        assert.equal(
          (
            await account.request("/api/auth/login", "POST", {
              email: user.email,
              password: "TestPass123!",
            })
          ).data.user.rejection_reason,
          "Use your own profile photo.",
        );
        assert.equal(
          (
            await admin.request("/api/admin/users", "PATCH", {
              userId: user.id,
              action: "edit",
              changes: { status: "approved" },
            })
          ).status,
          200,
        );
        assert.equal(
          (
            await db.execute({
              sql: "SELECT rejection_reason FROM users WHERE id=?",
              args: [user.id],
            })
          ).rows[0].rejection_reason,
          null,
        );
      },
    );
    await t.test(
      "passport photo constraints apply to registration, self-service and admin replacement",
      async () => {
        const badPhotos = [
          passportPhoto(450, 350),
          passportPhoto(350, 350),
          passportPhoto(140, 180),
          "data:image/jpeg;base64,/9j/AA==",
          doc,
        ];
        for (const bad of badPhotos) {
          assert.equal(
            (
              await stranger.request("/api/auth/register", "POST", {
                ...registration("driver", "photo-format@example.com"),
                profile_photo: bad,
              })
            ).status,
            400,
          );
          assert.equal(
            (await p2.request("/api/auth/me", "PATCH", { profile_photo: bad }))
              .status,
            400,
          );
          assert.equal(
            (
              await admin.request("/api/admin/users", "PATCH", {
                userId: p2Id,
                action: "edit",
                changes: { profile_photo: bad },
              })
            ).status,
            400,
          );
        }
        assert.equal(
          (
            await p2.request("/api/auth/me", "PATCH", {
              profile_photo: photo,
              name: "Passenger Profile Updated",
            })
          ).status,
          200,
        );
        assert.equal(
          (await p2.request("/api/auth/me")).data.user.name,
          "Passenger Profile Updated",
        );
        assert.equal(
          (await p2.request("/api/auth/me", "PATCH", { name: "  " })).status,
          400,
        );
        assert.equal(
          (await p2.request("/api/auth/me", "PATCH", { role: "admin" })).status,
          400,
        );
        assert.equal(
          (await p2.request("/api/auth/me", "PATCH", { profile_photo: null }))
            .status,
          200,
        );
        // Legacy square photos stay usable for unrelated updates and unchanged form saves.
        await db.execute({
          sql: "UPDATE users SET profile_photo=? WHERE id=?",
          args: [doc, p2Id],
        });
        assert.equal(
          (
            await p2.request("/api/auth/me", "PATCH", {
              profile_photo: doc,
              phone_number: "+60123456789",
            })
          ).status,
          200,
        );
        assert.equal(
          (
            await admin.request("/api/admin/users", "PATCH", {
              userId: p2Id,
              action: "edit",
              changes: { profile_photo: doc, name: "Legacy Photo" },
            })
          ).status,
          200,
        );
        assert.equal(
          (await p2.request("/api/auth/me", "PATCH", { profile_photo: null }))
            .status,
          200,
        );
        assert.equal(
          (await fetch(base + "/profile", { redirect: "manual" })).status,
          307,
        );
      },
    );
    const editUser = (userId, changes, extra = {}) =>
      admin.request("/api/admin/users", "PATCH", {
        userId,
        action: "edit",
        changes,
        ...extra,
      });
    let editedId, editedAccount;
    await t.test(
      "only admins can edit accounts; invalid and protected fields are rejected",
      async () => {
        for (const account of [stranger, driver, p2])
          assert.equal(
            (
              await account.request("/api/admin/users", "PATCH", {
                userId: p2Id,
                action: "edit",
                changes: { name: "Changed" },
              })
            ).status,
            account === stranger ? 401 : 403,
          );
        for (const changes of [
          null,
          [],
          {},
          { password_hash: "bad" },
          { session_version: 1 },
          { id: "new" },
          { created_at: now },
          { role: "owner" },
          { status: "disabled" },
          { name: "" },
          { email: "invalid" },
          { phone_number: "123" },
          { student_number: "x".repeat(41) },
          { profile_photo: "data:image/svg+xml;base64,PHN2Zz4=" },
          { student_id_doc: "bad" },
          { license_doc: "bad" },
          { password: "short" },
          { password: "🙂".repeat(20) },
        ]) {
          assert.equal(
            (await editUser(p2Id, changes)).status,
            400,
            JSON.stringify(changes),
          );
        }
        assert.equal(
          (await editUser("missing-user", { name: "Changed" })).status,
          404,
        );
        assert.equal(
          (await editUser(p2Id, { email: "ADMIN@EXAMPLE.COM" })).status,
          409,
        );
        assert.equal(
          (
            await editUser("admin", {
              status: "rejected",
              rejection_reason: "Please update your registration details.",
            })
          ).status,
          409,
        );
        assert.equal(
          (
            await editUser("admin", {
              role: "passenger",
              phone_number: "+60123456789",
              student_id_doc: doc,
            })
          ).status,
          409,
        );
        const list = await admin.request("/api/admin/users?tab=all");
        assert.ok(list.data.users.some((u) => u.id === "admin"));
        assert.ok(
          list.data.users.every(
            (u) => !("password_hash" in u) && !("password" in u),
          ),
        );
      },
    );
    await t.test(
      "admins edit identity, contact, documents, photo and password while revoking old sessions",
      async () => {
        editedAccount = client();
        assert.equal(
          (
            await editedAccount.request(
              "/api/auth/register",
              "POST",
              registration("passenger", "editable@example.com"),
            )
          ).status,
          200,
        );
        editedId = (await editedAccount.request("/api/auth/me")).data.user.id;
        const oldSession = client();
        oldSession.cookie = editedAccount.cookie;
        const before = (
          await db.execute({
            sql: "SELECT * FROM users WHERE id=?",
            args: [editedId],
          })
        ).rows[0];
        const changes = {
          name: "Updated Passenger",
          email: "  UPDATED@EXAMPLE.COM ",
          phone_number: "+60 123-456-789",
          student_number: "NEW-123",
          status: "approved",
          profile_photo: photo,
          student_id_doc: doc,
          license_doc: doc,
          password: "EditedPass123!",
        };
        const result = await editUser(editedId, changes, {
          expectedUpdatedAt: before.updated_at,
        });
        assert.equal(result.status, 200);
        assert.equal(result.data.user.name, "Updated Passenger");
        assert.equal(result.data.user.email, "updated@example.com");
        assert.equal(result.data.user.phone_number, "+60123456789");
        assert.equal(result.data.user.student_number, "NEW-123");
        assert.equal(result.data.user.student_id_doc, doc);
        assert.equal(result.data.user.license_doc, doc);
        assert.equal(result.data.user.profile_photo, photo);
        assert.equal(result.data.user.id, editedId);
        assert.equal(result.data.user.created_at, before.created_at);
        assert.ok(
          !("password" in result.data.user) &&
            !("password_hash" in result.data.user),
        );
        const saved = (
          await db.execute({
            sql: "SELECT * FROM users WHERE id=?",
            args: [editedId],
          })
        ).rows[0];
        assert.ok(await compare("EditedPass123!", saved.password_hash));
        assert.ok(!(await compare("TestPass123!", saved.password_hash)));
        assert.equal(
          Number(saved.session_version),
          Number(before.session_version) + 1,
        );
        assert.equal((await oldSession.request("/api/auth/me")).status, 401);
        assert.equal(
          (
            await editedAccount.request("/api/auth/login", "POST", {
              email: "editable@example.com",
              password: "TestPass123!",
            })
          ).status,
          401,
        );
        assert.equal(
          (
            await editedAccount.request("/api/auth/login", "POST", {
              email: "updated@example.com",
              password: "EditedPass123!",
            })
          ).status,
          200,
        );
        const bookingId = (await request(editedAccount)).data.bookingId;
        assert.ok(bookingId);
        assert.equal(
          (await editUser(editedId, { name: "Passenger Renamed" })).status,
          200,
        );
        assert.equal(
          (await editedAccount.request("/api/auth/me")).data.user.name,
          "Passenger Renamed",
        );
        assert.equal(
          (
            await db.execute({
              sql: "SELECT passenger_id FROM bookings WHERE id=?",
              args: [bookingId],
            })
          ).rows[0].passenger_id,
          editedId,
        );
        const logs = (
          await db.execute(
            "SELECT details FROM audit_logs WHERE action='EDIT_USER'",
          )
        ).rows;
        assert.ok(!JSON.stringify(logs).includes("EditedPass123!"));
        assert.ok(!JSON.stringify(logs).includes(saved.password_hash));
        assert.ok(!JSON.stringify(logs).includes(doc));
      },
    );
    await t.test(
      "admin role and approval edits enforce driver details and current access",
      async () => {
        assert.equal(
          (await editUser(editedId, { role: "driver" })).status,
          400,
        );
        const before = client();
        before.cookie = editedAccount.cookie;
        const result = await editUser(editedId, {
          role: "driver",
          car_colour: "Blue",
          car_type: "Proton Saga",
          car_plate: " xyz 2345 ",
        });
        assert.equal(result.status, 200);
        assert.equal(result.data.user.car_plate, "XYZ 2345");
        assert.equal((await before.request("/api/auth/me")).status, 401);
        assert.equal(
          (
            await editedAccount.request("/api/auth/login", "POST", {
              email: "updated@example.com",
              password: "EditedPass123!",
            })
          ).data.redirect,
          "/driver",
        );
        assert.equal(
          (await editUser(editedId, { profile_photo: null })).status,
          400,
        );
        assert.equal(
          (await editUser(editedId, { license_doc: null })).status,
          400,
        );
        assert.equal(
          (await editUser(editedId, { student_id_doc: null })).status,
          400,
        );
        assert.equal(
          (
            await editUser(editedId, {
              status: "pending",
              license_doc: null,
              profile_photo: null,
              car_colour: "",
              car_type: "",
              car_plate: "",
            })
          ).status,
          200,
        );
        assert.equal((await editedAccount.request("/api/auth/me")).status, 401);
        assert.equal(
          (await editUser(editedId, { status: "approved" })).status,
          400,
        );
        assert.equal(
          (await editUser(editedId, { role: "passenger", status: "approved" }))
            .status,
          200,
        );
      },
    );
    await t.test(
      "concurrent admin edits reject stale saves and duplicate email races",
      async () => {
        const before = (
          await db.execute({
            sql: "SELECT updated_at FROM users WHERE id=?",
            args: [editedId],
          })
        ).rows[0];
        const saves = await Promise.all(
          ["First", "Second"].map((name) =>
            editUser(
              editedId,
              { name },
              { expectedUpdatedAt: before.updated_at },
            ),
          ),
        );
        assert.deepEqual(saves.map((r) => r.status).sort(), [200, 409]);
        assert.equal(
          (
            await editUser(
              editedId,
              { name: "Stale" },
              { expectedUpdatedAt: before.updated_at },
            )
          ).status,
          409,
        );
        assert.equal(
          (
            await editUser(
              editedId,
              { name: "Invalid" },
              { expectedUpdatedAt: 123 },
            )
          ).status,
          400,
        );
        const duplicateClient = client();
        await duplicateClient.request(
          "/api/auth/register",
          "POST",
          registration("passenger", "duplicate-edit@example.com"),
        );
        const duplicateId = (await duplicateClient.request("/api/auth/me")).data
          .user.id;
        const races = await Promise.all(
          [editedId, duplicateId].map((id) =>
            editUser(id, { email: "same-edit@example.com" }),
          ),
        );
        assert.deepEqual(races.map((r) => r.status).sort(), [200, 409]);
      },
    );
    await t.test(
      "admins can edit other admins and their own credentials without losing the active session",
      async () => {
        const otherAdmin = client();
        await otherAdmin.request(
          "/api/auth/register",
          "POST",
          registration("passenger", "second-admin@example.com"),
        );
        const id = (await otherAdmin.request("/api/auth/me")).data.user.id;
        assert.equal(
          (
            await editUser(id, {
              role: "admin",
              status: "approved",
              name: "Second Admin",
            })
          ).status,
          200,
        );
        assert.equal(
          (
            await otherAdmin.request("/api/auth/login", "POST", {
              email: "second-admin@example.com",
              password: "TestPass123!",
            })
          ).data.redirect,
          "/admin",
        );
        assert.equal(
          (
            await editUser(id, {
              name: "Admin Renamed",
              student_id_doc: null,
              license_doc: null,
              email: "second-admin-renamed@example.com",
              password: "SecondAdmin123!",
            })
          ).status,
          200,
        );
        assert.equal(
          (await otherAdmin.request("/api/admin/users?tab=all")).status,
          401,
        );
        await otherAdmin.request("/api/auth/login", "POST", {
          email: "second-admin-renamed@example.com",
          password: "SecondAdmin123!",
        });
        assert.equal(
          (await otherAdmin.request("/api/admin/users?tab=all")).status,
          200,
        );
        assert.equal(
          (
            await editUser(id, {
              status: "rejected",
              rejection_reason: "Please update your registration details.",
            })
          ).status,
          200,
        );
        assert.equal(
          (
            await otherAdmin.request("/api/auth/login", "POST", {
              email: "second-admin-renamed@example.com",
              password: "SecondAdmin123!",
            })
          ).data.redirect,
          "/pending",
        );
        for (const path of [
          "/api/admin/users?tab=all",
          "/api/admin/overview",
          "/api/admin/logs",
          "/api/reports/logs",
        ])
          assert.equal((await otherAdmin.request(path)).status, 403);
        assert.equal(
          (
            await editUser("admin", {
              status: "rejected",
              rejection_reason: "Please update your registration details.",
            })
          ).status,
          409,
        );
        const oldAdmin = client();
        oldAdmin.cookie = admin.cookie;
        const self = await editUser("admin", {
          name: "Main Admin",
          email: "main-admin@example.com",
          password: "MainAdmin123!",
        });
        assert.equal(self.status, 200);
        assert.equal(self.data.redirect, "/admin");
        assert.equal(
          (await oldAdmin.request("/api/admin/users?tab=all")).status,
          401,
        );
        assert.equal(
          (await admin.request("/api/admin/users?tab=all")).status,
          200,
        );
        assert.equal(
          (
            await client().request("/api/auth/login", "POST", {
              email: "admin@example.com",
              password: "TestPass123!",
            })
          ).status,
          401,
        );
        const fresh = client();
        assert.equal(
          (
            await fresh.request("/api/auth/login", "POST", {
              email: "main-admin@example.com",
              password: "MainAdmin123!",
            })
          ).status,
          200,
        );
        assert.equal(
          (await fresh.request("/api/admin/users?tab=all")).status,
          200,
        );
      },
    );
    const removeUser = (account, userId, expectedUpdatedAt, extra = {}) =>
      account.request("/api/admin/users", "DELETE", {
        userId,
        expectedUpdatedAt,
        confirm: true,
        ...extra,
      });
    await t.test(
      "account removal requires admin access, confirmation and a current version",
      async () => {
        const version = (
          await db.execute("SELECT updated_at FROM users WHERE id='admin'")
        ).rows[0].updated_at;
        for (const account of [stranger, driver, p2])
          assert.equal(
            (await removeUser(account, "admin", version)).status,
            account === stranger ? 401 : 403,
          );
        assert.equal((await removeUser(admin, "admin", version)).status, 409);
        assert.equal((await removeUser(admin, p2Id, undefined)).status, 400);
        assert.equal(
          (await removeUser(admin, p2Id, "stale", { confirm: false })).status,
          400,
        );
        assert.equal((await removeUser(admin, p2Id, "stale")).status, 409);
        assert.equal(
          (await removeUser(admin, "missing-account", version)).status,
          404,
        );
        assert.equal(
          (await admin.request("/api/admin/users", "DELETE", [])).status,
          400,
        );
        assert.equal(
          (
            await db.execute(
              "SELECT COUNT(*) AS count FROM users WHERE deleted_at IS NOT NULL",
            )
          ).rows[0].count,
          0,
        );
      },
    );
    await t.test(
      "removing a passenger cancels uncollected requests, preserves income and revokes all access",
      async () => {
        const account = client(),
          email = "remove-passenger@example.com";
        assert.equal(
          (
            await account.request(
              "/api/auth/register",
              "POST",
              registration("passenger", email),
            )
          ).status,
          200,
        );
        const id = (await account.request("/api/auth/me")).data.user.id;
        assert.equal(
          (
            await admin.request("/api/admin/users", "PATCH", {
              userId: id,
              action: "approve",
            })
          ).status,
          200,
        );
        await account.request("/api/auth/login", "POST", {
          email,
          password: "TestPass123!",
        });
        const fixtureTime = new Date(Date.now() - 60000).toISOString();
        await db.execute({
          sql: "INSERT INTO rides (id,driver_id,from_zone,to_zone,departure_at,seats_total,seats_available,flat_rate,status,created_at) VALUES ('removal-seat',?,'Campus','Station',?,2,1,5,'open',?)",
          args: [driverId, future, fixtureTime],
        });
        for (const [suffix, status, arrived] of [
          ["pending", "pending", null],
          ["offered", "offered", null],
          ["accepted", "accepted", null],
          ["arrived", "accepted", fixtureTime],
          ["completed", "completed", fixtureTime],
        ])
          await db.execute({
            sql: "INSERT INTO bookings (id,ride_id,driver_id,passenger_id,from_zone,to_zone,departure_at,status,quoted_price,payment_method,arrived_at,created_at,updated_at) VALUES (?,?,?,?, 'Campus','Station',?,?,500,'cash',?,?,?)",
            args: [
              "removal-" + suffix,
              suffix === "accepted" ? "removal-seat" : null,
              driverId,
              id,
              future,
              status,
              arrived,
              fixtureTime,
              fixtureTime,
            ],
          });
        const walletBefore = (await driver.request("/api/wallet")).data;
        const countsBefore = (await admin.request("/api/admin/overview")).data
          .counts;
        const before = (
          await db.execute({
            sql: "SELECT * FROM users WHERE id=?",
            args: [id],
          })
        ).rows[0];
        const outcomes = await Promise.all([
          removeUser(admin, id, before.updated_at),
          removeUser(admin, id, before.updated_at),
        ]);
        assert.deepEqual(outcomes.map((r) => r.status).sort(), [200, 404]);
        const after = (
          await db.execute({
            sql: "SELECT * FROM users WHERE id=?",
            args: [id],
          })
        ).rows[0];
        assert.ok(after.deleted_at);
        assert.equal(
          Number(after.session_version),
          Number(before.session_version) + 1,
        );
        assert.notEqual(after.email, email);
        assert.equal(after.password_hash, "");
        const bookings = (
          await db.execute(
            "SELECT id,status FROM bookings WHERE id LIKE 'removal-%' ORDER BY id",
          )
        ).rows;
        assert.equal(bookings.length, 5);
        for (const b of bookings)
          assert.equal(
            b.status,
            b.id === "removal-arrived"
              ? "accepted"
              : b.id === "removal-completed"
                ? "completed"
                : "cancelled",
          );
        assert.equal(
          (
            await db.execute(
              "SELECT seats_available FROM rides WHERE id='removal-seat'",
            )
          ).rows[0].seats_available,
          2,
        );
        const walletAfter = (await driver.request("/api/wallet")).data;
        assert.deepEqual(walletAfter.periods, walletBefore.periods);
        assert.deepEqual(walletAfter.recent, walletBefore.recent);
        for (const tab of ["all", "pending", "approved", "rejected"])
          assert.ok(
            !(
              await admin.request("/api/admin/users?tab=" + tab)
            ).data.users.some((u) => u.id === id),
          );
        const countsAfter = (await admin.request("/api/admin/overview")).data
          .counts;
        assert.equal(countsAfter.all, countsBefore.all - 1);
        assert.equal(countsAfter.approved, countsBefore.approved - 1);
        assert.equal(
          (
            await db.execute({
              sql: "SELECT COUNT(*) AS count FROM audit_logs WHERE action='REMOVE_USER' AND details=?",
              args: [`Removed account ${id}`],
            })
          ).rows[0].count,
          1,
        );
        for (const path of ["/api/auth/me", "/api/bookings", "/api/history"])
          assert.equal((await account.request(path)).status, 401);
        assert.equal((await request(account)).status, 401);
        assert.equal(
          (
            await account.request("/api/auth/me", "PATCH", {
              phone_number: "+60123456789",
            })
          ).status,
          401,
        );
        assert.equal(
          (
            await account.request("/api/auth/resubmit", "POST", {
              student_id_doc: doc,
            })
          ).status,
          401,
        );
        assert.equal(
          (
            await account.request("/api/auth/login", "POST", {
              email,
              password: "TestPass123!",
            })
          ).status,
          401,
        );
        assert.equal((await editUser(id, { name: "Restored" })).status, 404);
        for (const action of ["approve", "reject"])
          assert.equal(
            (
              await admin.request("/api/admin/users", "PATCH", {
                userId: id,
                action,
                rejection_reason: "Please update your registration details.",
              })
            ).status,
            404,
          );
        const replacement = client();
        assert.equal(
          (
            await replacement.request(
              "/api/auth/register",
              "POST",
              registration("passenger", email),
            )
          ).status,
          200,
        );
        assert.notEqual(
          (await replacement.request("/api/auth/me")).data.user.id,
          id,
        );
        assert.equal((await account.request("/api/auth/me")).status, 401);
      },
    );
    await t.test(
      "driver and administrator removal preserve records and recheck administrator access",
      async () => {
        const account = client();
        await account.request(
          "/api/auth/register",
          "POST",
          registration("driver", "remove-driver@example.com"),
        );
        const id = (await account.request("/api/auth/me")).data.user.id;
        await admin.request("/api/admin/users", "PATCH", {
          userId: id,
          action: "approve",
        });
        await account.request("/api/auth/login", "POST", {
          email: "remove-driver@example.com",
          password: "TestPass123!",
        });
        const time = new Date().toISOString();
        await db.execute({
          sql: "INSERT INTO rides (id,driver_id,from_zone,to_zone,departure_at,seats_total,seats_available,flat_rate,status,created_at) VALUES ('removed-driver-ride',?,'Campus','Station',?,2,2,5,'open',?)",
          args: [id, future, time],
        });
        for (const [suffix, status, arrived] of [
          ["offer", "offered", null],
          ["earned", "completed", time],
        ])
          await db.execute({
            sql: "INSERT INTO bookings (id,driver_id,passenger_id,from_zone,to_zone,departure_at,status,quoted_price,payment_method,arrived_at,created_at,updated_at) VALUES (?, ?, ?, 'Campus','Station',?,?,750,'cash',?,?,?)",
            args: [
              "removed-driver-" + suffix,
              id,
              p2Id,
              future,
              status,
              arrived,
              time,
              time,
            ],
          });
        const version = (
          await db.execute({
            sql: "SELECT updated_at FROM users WHERE id=?",
            args: [id],
          })
        ).rows[0].updated_at;
        assert.equal((await removeUser(admin, id, version)).status, 200);
        assert.equal(
          (
            await db.execute(
              "SELECT status FROM rides WHERE id='removed-driver-ride'",
            )
          ).rows[0].status,
          "cancelled",
        );
        assert.equal(
          (
            await db.execute(
              "SELECT status FROM bookings WHERE id='removed-driver-offer'",
            )
          ).rows[0].status,
          "cancelled",
        );
        assert.equal(
          (
            await db.execute(
              "SELECT status,quoted_price FROM bookings WHERE id='removed-driver-earned'",
            )
          ).rows[0].quoted_price,
          750,
        );
        assert.equal((await account.request("/api/wallet")).status, 401);
        assert.equal(
          (await patch(account, "removed-driver-offer", "withdraw")).status,
          401,
        );
        // A removed administrator cannot perform an action that waited behind removal.
        const { removeAdminUser } = await import("../src/lib/admin-users.ts");
        const { requireActiveAccount } = await import("../src/lib/user.ts");
        const { initializeSchema } = await import("../src/lib/migrations.ts");
        assert.equal((await editUser(id, { role: "admin" })).status, 404);
        await assert.rejects(
          removeAdminUser(db, id, p2Id, time),
          (e) => e.status === 403,
        );
        await assert.rejects(
          requireActiveAccount(db, {
            id,
            role: "driver",
            status: "approved",
            session_version: 0,
          }),
          (e) => e.status === 401,
        );
        await initializeSchema(db);
        assert.ok(
          (
            await db.execute({
              sql: "SELECT deleted_at FROM users WHERE id=?",
              args: [id],
            })
          ).rows[0].deleted_at,
        );
        // Create and remove a second approved administrator without losing the last one.
        const second = client();
        await second.request(
          "/api/auth/register",
          "POST",
          registration("passenger", "removable-admin@example.com"),
        );
        const secondId = (await second.request("/api/auth/me")).data.user.id;
        assert.equal(
          (await editUser(secondId, { role: "admin", status: "approved" }))
            .status,
          200,
        );
        await second.request("/api/auth/login", "POST", {
          email: "removable-admin@example.com",
          password: "TestPass123!",
        });
        const secondVersion = (
          await db.execute({
            sql: "SELECT updated_at FROM users WHERE id=?",
            args: [secondId],
          })
        ).rows[0].updated_at;
        assert.equal(
          (await removeUser(second, secondId, secondVersion)).status,
          409,
        );
        assert.equal(
          (await removeUser(admin, secondId, secondVersion)).status,
          200,
        );
        assert.equal(
          (await second.request("/api/admin/users?tab=all")).status,
          401,
        );
        assert.equal(
          (
            await editUser("admin", {
              status: "rejected",
              rejection_reason: "Please update your registration details.",
            })
          ).status,
          409,
        );
        assert.equal(
          (await db.execute("PRAGMA foreign_key_check")).rows.length,
          0,
        );
      },
    );
    await t.test(
      "password recovery is removed and normal sign-in remains available",
      async () => {
        const login = await fetch(base + "/login");
        assert.equal(login.status, 200);
        const html = await login.text();
        assert.ok(
          !html.includes("Forgot password?") &&
            !html.includes("/forgot-password"),
        );
        for (const path of [
          "/api/auth/forgot-password",
          "/api/auth/verify-reset-code",
          "/api/auth/reset-password",
          "/api/admin/password-reset",
        ]) {
          assert.equal((await admin.request(path, "POST", {})).status, 404);
        }
        for (const path of ["/forgot-password", "/reset-password"]) {
          assert.equal(
            (
              await fetch(base + path, {
                headers: { Cookie: admin.cookie },
                redirect: "manual",
              })
            ).status,
            404,
          );
        }
        assert.equal(
          (
            await p2.request("/api/auth/login", "POST", {
              email: "p2@example.com",
              password: "TestPass123!",
            })
          ).status,
          200,
        );
        assert.equal((await p2.request("/api/auth/me")).status, 200);
      },
    );
    await t.test(
      "PDF downloads contain only the signed-in account's bookings and monthly archives are private",
      async () => {
        const {
          PDFDocument,
          PDFName,
          PDFDict,
          PDFArray,
          PDFRawStream,
          decodePDFRawStream,
        } = await import("pdf-lib");
        const { createBookingPdf } = await import(
          "../src/lib/booking-reports.ts"
        );
        const parseRecords = async (bytes) => {
          const pdf = await PDFDocument.load(bytes);
          const names = pdf.catalog
            .lookup(PDFName.of("Names"), PDFDict)
            .lookup(PDFName.of("EmbeddedFiles"), PDFDict)
            .lookup(PDFName.of("Names"), PDFArray);
          const stream = names
            .lookup(1, PDFDict)
            .lookup(PDFName.of("EF"), PDFDict)
            .lookup(PDFName.of("F"), PDFRawStream);
          return JSON.parse(
            new TextDecoder().decode(decodePDFRawStream(stream).decode()),
          );
        };
        assert.equal(
          (await stranger.request("/api/reports/bookings")).status,
          401,
        );
        assert.equal((await p1.request("/api/reports/bookings")).status, 403);
        assert.equal(
          (
            await admin.request("/api/admin/users", "PATCH", {
              userId: p1Id,
              action: "approve",
            })
          ).status,
          200,
        );
        for (const [account, id, role] of [
          [p1, p1Id, "passenger"],
          [p2, p2Id, "passenger"],
          [driver, driverId, "driver"],
          [admin, "admin", "admin"],
        ]) {
          const response = await fetch(base + "/api/reports/bookings", {
            headers: { Cookie: account.cookie },
          });
          assert.equal(response.status, 200);
          assert.equal(response.headers.get("content-type"), "application/pdf");
          assert.ok(
            response.headers.get("content-disposition").includes(role + ".pdf"),
          );
          const records = await parseRecords(
            new Uint8Array(await response.arrayBuffer()),
          );
          const where =
            role === "admin"
              ? ""
              : ` WHERE ${role === "driver" ? "driver_id" : "passenger_id"}=?`;
          const owned = (
            await db.execute({
              sql:
                "SELECT id FROM bookings" +
                where +
                " ORDER BY created_at DESC,id DESC",
              args: role === "admin" ? [] : [id],
            })
          ).rows;
          assert.deepEqual(
            records.bookings.map((b) => b.id),
            owned.map((b) => b.id),
          );
          assert.equal(records.role, role);
          assert.ok(
            records.bookings.every(
              (b) =>
                !("password_hash" in b) &&
                !("student_id_doc" in b) &&
                !("profile_photo" in b),
            ),
          );
        }
        for (const [id, role] of [
          [p1Id, "passenger"],
          [p2Id, "passenger"],
          [driverId, "driver"],
          [null, "admin"],
        ]) {
          const pdf = await createBookingPdf([], {
            name: "Fixture report",
            role,
            month: "2026-01",
            archived: true,
          });
          await db.execute({
            sql: "INSERT INTO monthly_booking_reports (id,owner_id,audience_role,month,booking_count,pdf_data,created_at) VALUES (?,?,?,'2026-01',1,?,?)",
            args: ["pdf-" + (id ?? "global"), id, role, Buffer.from(pdf), now],
          });
        }
        assert.equal(
          (await stranger.request("/api/reports/monthly")).status,
          401,
        );
        for (const account of [p1, p2, driver, admin]) {
          const result = await account.request("/api/reports/monthly");
          assert.equal(result.status, 200);
          assert.equal(result.data.reports.length, 1);
          assert.equal(result.data.reports[0].booking_count, 1);
        }
        assert.equal(
          (
            await p2.request(
              "/api/reports/monthly?month=2026-01&role=driver&userId=" +
                driverId,
            )
          ).status,
          404,
        );
        assert.equal(
          (await p2.request("/api/reports/monthly?month=2026-01&role=admin"))
            .status,
          404,
        );
        assert.equal(
          (
            await p2.request(
              "/api/reports/monthly?month=2026-13&role=passenger",
            )
          ).status,
          400,
        );
        for (const [account, role] of [
          [p2, "passenger"],
          [driver, "driver"],
          [admin, "admin"],
        ]) {
          const response = await fetch(
            base + `/api/reports/monthly?month=2026-01&role=${role}`,
            { headers: { Cookie: account.cookie } },
          );
          assert.equal(response.status, 200);
          assert.equal(
            (
              await PDFDocument.load(
                new Uint8Array(await response.arrayBuffer()),
              )
            ).getPageCount(),
            1,
          );
        }
        const newer = await createBookingPdf([], {
          name: "Newest monthly part",
          role: "passenger",
          month: "2026-01",
          archived: true,
        });
        await db.execute({
          sql: "INSERT INTO monthly_booking_reports (id,owner_id,audience_role,month,booking_count,pdf_data,created_at,latest_booking_at,latest_booking_id) VALUES ('newer-pdf',?,'passenger','2026-01',2,?,?,'2026-01-20','newer-booking')",
          args: [p2Id, Buffer.from(newer), now],
        });
        const combinedResponse = await fetch(
          base + "/api/reports/monthly?month=2026-01&role=passenger",
          { headers: { Cookie: p2.cookie } },
        );
        assert.equal(combinedResponse.status, 200);
        const combined = await PDFDocument.load(
          new Uint8Array(await combinedResponse.arrayBuffer()),
        );
        assert.equal(combined.getPageCount(), 3); // summary cover followed by two original snapshots
        const files = combined.catalog
          .lookup(PDFName.of("Names"), PDFDict)
          .lookup(PDFName.of("EmbeddedFiles"), PDFDict)
          .lookup(PDFName.of("Names"), PDFArray);
        assert.equal(files.size(), 4);
        const firstPart = files
          .lookup(1, PDFDict)
          .lookup(PDFName.of("EF"), PDFDict)
          .lookup(PDFName.of("F"), PDFRawStream);
        assert.equal(
          (await parseRecords(decodePDFRawStream(firstPart).decode())).account,
          "Newest monthly part",
        );
        assert.equal(
          (await p2.request("/api/reports/monthly")).data.reports[0]
            .booking_count,
          3,
        );
      },
    );
    await t.test(
      "monthly cron requires its bearer secret and remains disabled until retention is configured",
      async () => {
        const before = (await db.execute("SELECT COUNT(*) AS n FROM bookings"))
          .rows[0].n;
        assert.equal(
          (await stranger.request("/api/cron/bookings-monthly")).status,
          401,
        );
        assert.equal(
          (await admin.request("/api/cron/bookings-monthly")).status,
          401,
        );
        assert.equal(
          (
            await fetch(base + "/api/cron/bookings-monthly", {
              headers: { Authorization: "Bearer wrong" },
            })
          ).status,
          401,
        );
        assert.equal(
          (
            await fetch(base + "/api/cron/bookings-monthly", {
              headers: {
                Authorization:
                  "Bearer integration-only-cron-secret-32-characters",
              },
            })
          ).status,
          503,
        );
        assert.equal(
          (await db.execute("SELECT COUNT(*) AS n FROM bookings")).rows[0].n,
          before,
        );
      },
    );
  },
);
