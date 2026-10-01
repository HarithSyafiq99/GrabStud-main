import { NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { ensureSchema, getDb, writeAudit } from "@/lib/db";
import { isValidEmail, jsonError } from "@/lib/http";
import { createSession } from "@/lib/auth";
import type { Role, UserStatus } from "@/lib/types";

export async function POST(request: Request) {
  try {
    await ensureSchema();
    const body = await request.json();
    const email = String(body.email ?? "")
      .trim()
      .toLowerCase();
    const password = String(body.password ?? "");

    if (!isValidEmail(email) || !password) {
      return jsonError("Email and password are required.");
    }

    const db = getDb();
    const result = await db.execute({
      sql: "SELECT * FROM users WHERE email = ?",
      args: [email],
    });
    const row = result.rows[0];
    if (!row) return jsonError("Invalid credentials.", 401);

    const ok = await compare(password, String(row.password_hash));
    if (!ok) return jsonError("Invalid credentials.", 401);

    const user = {
      id: String(row.id),
      name: String(row.name),
      email: String(row.email),
      role: row.role as Role,
      status: row.status as UserStatus,
    };

    await createSession(user);
    await writeAudit(user.id, "LOGIN", `${user.email} signed in`);

    let redirect = "/pending";
    if (user.role === "admin") redirect = "/admin";
    else if (user.status === "approved" && user.role === "driver")
      redirect = "/driver";
    else if (user.status === "approved") redirect = "/passenger";

    return NextResponse.json({ ok: true, user, redirect });
  } catch (error) {
    console.error(error);
    return jsonError("Login failed.", 500);
  }
}
