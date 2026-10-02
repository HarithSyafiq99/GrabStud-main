import { readFileSync } from "node:fs";
import { hash } from "bcryptjs";
import { createClient } from "@libsql/client";
import { loadEnvLocal, resolveSqliteUrl } from "./env";
import { initializeSchema } from "../src/lib/migrations";
import { ZONES } from "../src/lib/zones";
loadEnvLocal();
async function main() {
  const url = resolveSqliteUrl();
  if (!url.startsWith("file:"))
    throw new Error(
      "Demo seed is local-only. Use db:seed for a remote database.",
    );
  const db = createClient({ url });
  await initializeSchema(db);
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
      email: "passenger@grabstudent.com",
      role: "passenger",
      status: "approved",
    },
    {
      id: "demo-driver",
      name: "Aiman Hakim",
      email: "driver@grabstudent.com",
      role: "driver",
      status: "approved",
    },
    {
      id: "demo-driver-2",
      name: "Sarah Amira",
      email: "sarah@grabstudent.com",
      role: "driver",
      status: "approved",
    },
    {
      id: "demo-pending",
      name: "Nur Alya",
      email: "alya@grabstudent.com",
      role: "passenger",
      status: "pending",
    },
  ];
  for (const u of people)
    await db.execute({
      sql: "INSERT INTO users (id,name,email,phone_number,password_hash,student_number,role,status,student_id_doc,license_doc,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET email=excluded.email, phone_number=excluded.phone_number",
      args: [
        u.id,
        u.name,
        u.email,
        "+6010000000" + people.indexOf(u),
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
    await db.execute({
      sql: "INSERT OR IGNORE INTO bookings (id,passenger_id,from_zone,to_zone,departure_at,status,payment_method,created_at,updated_at) VALUES (?,?,?,?,?,'pending','cash',?,?)",
      args: [
        "demo-request-" + i,
        "demo-passenger",
        ZONES[i % 3],
        ZONES[3 + i],
        new Date(Date.now() + (i + 2) * 3600000).toISOString(),
        now,
        now,
      ],
    });
  }
  db.close();
  console.log(
    "Local demo accounts and passenger journey requests ready. See README for logins.",
  );
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
