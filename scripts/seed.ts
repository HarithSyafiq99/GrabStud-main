import { hash } from "bcryptjs";
import { createClient } from "@libsql/client";
import { initializeSchema } from "../src/lib/migrations";
import { loadEnvLocal, resolveSqliteUrl } from "./env";

loadEnvLocal();

async function main() {
  const url = resolveSqliteUrl();
  const db = createClient({
    url,
    authToken: process.env.TURSO_AUTH_TOKEN || undefined,
  });

  await initializeSchema(db);

  const adminEmail = process.env.ADMIN_EMAIL || "admin@grabstudent.com";
  const adminPassword =
    process.env.ADMIN_PASSWORD ||
    (process.env.NODE_ENV !== "production" && url.startsWith("file:")
      ? "Admin123!"
      : "");
  if (!adminPassword || adminPassword.length < 8)
    throw new Error(
      "Set ADMIN_PASSWORD (8+ characters) before seeding a remote or production database.",
    );
  if (url.startsWith("file:") && adminEmail === "admin@grabstudent.com") {
    await db.execute({
      sql: "UPDATE users SET email=? WHERE email=? AND role='admin' AND NOT EXISTS (SELECT 1 FROM users WHERE email=?)",
      args: [adminEmail, "admin@grabstudent.edu", adminEmail],
    });
  }
  const existing = await db.execute({
    sql: "SELECT id FROM users WHERE email = ?",
    args: [adminEmail],
  });

  if (existing.rows.length === 0) {
    const password_hash = await hash(adminPassword, 10);
    const now = new Date().toISOString();
    await db.execute({
      sql: `INSERT INTO users
            (id, name, email, password_hash, student_number, role, status, student_id_doc, license_doc, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, 'admin', 'approved', NULL, NULL, ?, ?)`,
      args: [
        crypto.randomUUID(),
        "Platform Admin",
        adminEmail,
        password_hash,
        "ADMIN-0001",
        now,
        now,
      ],
    });
    console.log(
      "Admin created. Use the ADMIN_EMAIL and ADMIN_PASSWORD you configured.",
    );
  } else {
    console.log("Admin already exists (password unchanged).");
  }
  db.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
