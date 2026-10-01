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
      sql: "INSERT INTO users VALUES (?,?,?,?,?,?,?,?,?,?,?)",
      args: [
        "admin",
        "Admin",
        "admin@test.edu",
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
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    proc.stdout.on("data", (d) => (output += d));
    proc.stderr.on("data", (d) => (output += d));
    t.after(async () => {
      proc.kill("SIGTERM");
      await new Promise((r) => {
        proc.once("exit", r);
        setTimeout(() => {
          proc.kill("SIGKILL");
          r();
        }, 5000).unref();
      });
      db.close();
      await rm(dir, { recursive: true, force: true });
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
          headers: { "Content-Type": "application/json", Cookie: this.cookie },
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
      p1 = client(),
      p2 = client(),
      stranger = client();
    const doc =
      "data:image/png;base64," +
      (await readFile("public/demo/student-id.png")).toString("base64");
    const signup = (c, role, email) =>
      c.request("/api/auth/register", "POST", {
        name: email.split("@")[0],
        email,
        password: "TestPass123!",
        student_number: email,
        role,
        student_id_doc: doc,
        license_doc: role === "driver" ? doc : null,
      });
    let driverId, p1Id, p2Id, rideId, b1, b2;
    await t.test(
      "unauthenticated and cross-origin requests are blocked",
      async () => {
        assert.equal((await stranger.request("/api/rides")).status, 401);
        const r = await fetch(base + "/api/auth/login", {
          method: "POST",
          headers: {
            Origin: "https://evil.example",
            "Content-Type": "application/json",
          },
          body: "{}",
        });
        assert.equal(r.status, 403);
      },
    );
    await t.test("admin login and upload validation", async () => {
      assert.equal(
        (
          await admin.request("/api/auth/login", "POST", {
            email: "admin@test.edu",
            password: "TestPass123!",
          })
        ).status,
        200,
      );
      assert.equal(
        (
          await stranger.request("/api/auth/register", "POST", {
            name: "Bad",
            email: "bad@test.edu",
            password: "TestPass123!",
            student_number: "bad",
            role: "driver",
            student_id_doc: "data:image/svg+xml;base64,PHN2Zz4=",
            license_doc: doc,
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await stranger.request("/api/auth/register", "POST", {
            name: "Bad",
            email: "bad@test.edu",
            password: "TestPass123!",
            student_number: "bad",
            role: "driver",
            student_id_doc: doc,
          })
        ).status,
        400,
      );
    });
    await t.test("pending users cannot create rides or book", async () => {
      for (const [c, role, email] of [
        [driver, "driver", "driver@test.edu"],
        [p1, "passenger", "p1@test.edu"],
        [p2, "passenger", "p2@test.edu"],
      ])
        assert.equal((await signup(c, role, email)).status, 200);
      assert.equal(
        (await driver.request("/api/rides", "POST", {})).status,
        403,
      );
      assert.equal(
        (await p1.request("/api/rides/unknown/book", "POST", {})).status,
        403,
      );
      const r = await admin.request("/api/admin/users?tab=pending");
      driverId = r.data.users.find((u) => u.email === "driver@test.edu").id;
      p1Id = r.data.users.find((u) => u.email === "p1@test.edu").id;
      p2Id = r.data.users.find((u) => u.email === "p2@test.edu").id;
    });
    await t.test(
      "approval is authoritative for existing sessions",
      async () => {
        for (const id of [driverId, p1Id, p2Id])
          assert.equal(
            (
              await admin.request("/api/admin/users", "PATCH", {
                userId: id,
                action: "approve",
              })
            ).status,
            200,
          );
        assert.equal((await driver.request("/api/rides?mine=1")).status, 200);
        assert.equal((await p1.request("/api/admin/users")).status, 403);
        // Approval must work even before the original pending JWT is refreshed.
        const pendingPage = await fetch(base + "/pending", {
          headers: { Cookie: driver.cookie },
        });
        assert.equal(pendingPage.status, 200);
        assert.ok(pendingPage.url.endsWith("/driver"));
        for (const c of [driver, p1, p2]) await c.request("/api/auth/me");
      },
    );
    const future = new Date(Date.now() + 7200000).toISOString();
    const ride = {
      from_zone: "Main Campus",
      to_zone: "Library",
      departure_at: future,
      seats_total: 1,
      flat_rate: 999,
    };
    await t.test(
      "past time, matching zones and seat cap are rejected",
      async () => {
        for (const patch of [
          { departure_at: new Date(Date.now() - 60000).toISOString() },
          { seats_total: 5 },
          { seats_total: 1.5 },
          { to_zone: "Main Campus" },
        ])
          assert.equal(
            (await driver.request("/api/rides", "POST", { ...ride, ...patch }))
              .status,
            400,
          );
        assert.equal(
          (await p1.request("/api/rides", "POST", ride)).status,
          403,
        );
      },
    );
    await t.test("system determines price and creates ride", async () => {
      const r = await driver.request("/api/rides", "POST", ride);
      assert.equal(r.status, 200);
      assert.equal(r.data.flat_rate, 3);
      rideId = r.data.id;
      assert.equal(
        (await p1.request("/api/rides?from=Main%20Campus&to=Library")).data
          .rides[0].flat_rate,
        3,
      );
    });
    await t.test(
      "duplicate bookings and unauthorized acceptance are blocked",
      async () => {
        const r1 = await p1.request(`/api/rides/${rideId}/book`, "POST", {
            payment_method: "qr",
          }),
          r2 = await p2.request(`/api/rides/${rideId}/book`, "POST", {});
        assert.equal(r1.status, 200);
        assert.equal(r2.status, 200);
        b1 = r1.data.bookingId;
        b2 = r2.data.bookingId;
        assert.equal(
          (await p1.request(`/api/rides/${rideId}/book`, "POST", {})).status,
          409,
        );
        assert.equal(
          (
            await p1.request(`/api/bookings/${b1}`, "PATCH", {
              action: "accept",
            })
          ).status,
          403,
        );
      },
    );
    let winner;
    await t.test(
      "simultaneous acceptance cannot oversell last seat",
      async () => {
        const responses = await Promise.all(
          [b1, b2].map((id) =>
            driver.request(`/api/bookings/${id}`, "PATCH", {
              action: "accept",
            }),
          ),
        );
        assert.deepEqual(responses.map((r) => r.status).sort(), [200, 409]);
        winner = responses[0].status === 200 ? p1 : p2;
        const r = await db.execute({
          sql: "SELECT * FROM rides WHERE id=?",
          args: [rideId],
        });
        assert.equal(Number(r.rows[0].seats_available), 0);
        assert.equal(r.rows[0].status, "full");
        assert.equal(
          (await stranger.request(`/api/rides/${rideId}/book`, "POST", {}))
            .status,
          401,
        );
      },
    );
    await t.test(
      "cancellation restores seat and repeat cancellation is blocked",
      async () => {
        const id = winner === p1 ? b1 : b2;
        assert.equal(
          (
            await winner.request(`/api/bookings/${id}`, "PATCH", {
              action: "cancel",
            })
          ).status,
          200,
        );
        assert.equal(
          (
            await winner.request(`/api/bookings/${id}`, "PATCH", {
              action: "cancel",
            })
          ).status,
          409,
        );
        const r = await db.execute({
          sql: "SELECT seats_available,status FROM rides WHERE id=?",
          args: [rideId],
        });
        assert.equal(Number(r.rows[0].seats_available), 1);
        assert.equal(r.rows[0].status, "open");
      },
    );
    await t.test(
      "cancelled and rejected bookings can be requested again",
      async () => {
        const c = winner === p1 ? p1 : p2,
          id = winner === p1 ? b1 : b2;
        assert.equal(
          (await c.request(`/api/rides/${rideId}/book`, "POST", {})).status,
          200,
        );
        assert.equal(
          (
            await driver.request(`/api/bookings/${id}`, "PATCH", {
              action: "reject",
            })
          ).status,
          200,
        );
        assert.equal(
          (await c.request(`/api/rides/${rideId}/book`, "POST", {})).status,
          200,
        );
        assert.equal(
          (
            await driver.request(`/api/bookings/${id}`, "PATCH", {
              action: "accept",
            })
          ).status,
          200,
        );
      },
    );
    await t.test(
      "driver cancellation propagates and completion respects departure",
      async () => {
        assert.equal(
          (
            await driver.request(`/api/rides/${rideId}`, "PATCH", {
              action: "complete",
            })
          ).status,
          400,
        );
        assert.equal(
          (
            await p1.request(`/api/rides/${rideId}`, "PATCH", {
              action: "cancel",
            })
          ).status,
          403,
        );
        assert.equal(
          (
            await driver.request(`/api/rides/${rideId}`, "PATCH", {
              action: "cancel",
            })
          ).status,
          200,
        );
        const bs = await db.execute({
          sql: "SELECT status FROM bookings WHERE ride_id=?",
          args: [rideId],
        });
        assert.ok(bs.rows.every((r) => r.status === "cancelled"));
        const posted = await driver.request("/api/rides", "POST", ride);
        await db.execute({
          sql: "UPDATE rides SET departure_at=? WHERE id=?",
          args: [new Date(Date.now() - 1000).toISOString(), posted.data.id],
        });
        assert.equal(
          (
            await driver.request(`/api/rides/${posted.data.id}`, "PATCH", {
              action: "complete",
            })
          ).status,
          200,
        );
      },
    );
    await t.test(
      "revoked approval immediately prevents API writes and allows resubmission",
      async () => {
        await admin.request("/api/admin/users", "PATCH", {
          userId: p1Id,
          action: "reject",
        });
        assert.equal(
          (await p1.request(`/api/rides/${rideId}/book`, "POST", {})).status,
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
      "history, notifications, logs and CSV reports work",
      async () => {
        assert.ok(
          (await admin.request("/api/history")).data.history.length >= 2,
        );
        assert.equal((await p2.request("/api/notifications")).status, 200);
        assert.ok(
          (await admin.request("/api/admin/logs")).data.logs.some(
            (l) => l.action === "CANCEL_RIDE",
          ),
        );
        const csv = await admin.request("/api/reports/history");
        assert.equal(csv.status, 200);
        assert.match(csv.data, /payment_method/);
        assert.equal((await p2.request("/api/reports/logs")).status, 403);
      },
    );
  },
);
