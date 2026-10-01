import { readFileSync } from "node:fs";
import { hash } from "bcryptjs";
import { createClient } from "@libsql/client";
import { loadEnvLocal, resolveSqliteUrl } from "./env";
import { SCHEMA_SQL } from "../src/lib/schema";
import { getFlatRate, ZONES } from "../src/lib/zones";
loadEnvLocal();
async function main() {
  const url = resolveSqliteUrl();
  if (!url.startsWith("file:"))
    throw new Error(
      "Demo seed is local-only. Use db:seed for a remote database.",
    );
  const db = createClient({ url });
  for (const sql of SCHEMA_SQL.split(";")
    .map((s) => s.trim())
    .filter(Boolean))
    await db.execute(sql);
  const now = new Date().toISOString(),
    password = await hash("Student123!", 10);
  // Synthetic document only; no real student information.
  const doc =
    "data:image/png;base64," +
    readFileSync("public/demo/student-id.png").toString("base64");
  const people = [
    {
      id: "demo-passenger",
      name: "Harith Syafiq",
      email: "passenger@grabstudent.edu",
      role: "passenger",
      status: "approved",
    },
    {
      id: "demo-driver",
      name: "Aiman Hakim",
      email: "driver@grabstudent.edu",
      role: "driver",
      status: "approved",
    },
    {
      id: "demo-driver-2",
      name: "Sarah Amira",
      email: "sarah@grabstudent.edu",
      role: "driver",
      status: "approved",
    },
    {
      id: "demo-pending",
      name: "Nur Alya",
      email: "alya@grabstudent.edu",
      role: "passenger",
      status: "pending",
    },
  ];
  for (const u of people)
    await db.execute({
      sql: "INSERT OR IGNORE INTO users VALUES (?,?,?,?,?,?,?,?,?,?,?)",
      args: [
        u.id,
        u.name,
        u.email,
        password,
        "DEMO-" + u.id,
        u.role,
        u.status,
        doc,
        u.role === "driver" ? doc : null,
        now,
        now,
      ],
    });
  for (let i = 0; i < 6; i++) {
    const from = ZONES[i % 3],
      to = ZONES[3 + i],
      driver = i % 2 ? "demo-driver-2" : "demo-driver";
    await db.execute({
      sql: "INSERT OR IGNORE INTO rides VALUES (?,?,?,?,?,?,?,?,?,?)",
      args: [
        `demo-ride-${i}`,
        driver,
        from,
        to,
        new Date(Date.now() + (i + 2) * 3600000).toISOString(),
        3,
        3,
        getFlatRate(from, to),
        "open",
        now,
      ],
    });
  }
  await db.execute({
    sql: "INSERT OR IGNORE INTO bookings VALUES (?,?,?,'pending','cash',?,?)",
    args: ["demo-booking", "demo-ride-0", "demo-passenger", now, now],
  });
  db.close();
  console.log(
    "Local demo accounts and sample rides ready. See README for logins.",
  );
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
