import { NextResponse } from "next/server";
import { createSession, getSession } from "@/lib/auth";
import { ensureSchema, getDb, nowIso, writeAudit } from "@/lib/db";
import {
  handleError,
  isValidPhone,
  normalizePhone,
  jsonError,
} from "@/lib/http";
import type { Role, UserStatus } from "@/lib/types";

export async function GET() {
  const session = await getSession();
  if (!session) return jsonError("Unauthorized", 401);
  await ensureSchema();
  const db = getDb();
  const result = await db.execute({
    sql: "SELECT id, name, email, phone_number, role, status FROM users WHERE id = ?",
    args: [session.id],
  });
  const row = result.rows[0];
  if (!row) return jsonError("Unauthorized", 401);
  const user = {
    id: String(row.id),
    name: String(row.name),
    email: String(row.email),
    phone_number: String(row.phone_number),
    role: row.role as Role,
    status: row.status as UserStatus,
  };
  await createSession(user);
  return NextResponse.json({ user });
}

export async function PATCH(request: Request) {
  try {
    const user = await getSession();
    if (!user) return jsonError("Unauthorized", 401);
    const body = await request.json();
    const phone = normalizePhone(body.phone_number);
    if (!isValidPhone(phone))
      return jsonError("Enter a valid phone number with 8 to 15 digits.");
    await getDb().execute({
      sql: "UPDATE users SET phone_number=?, updated_at=? WHERE id=?",
      args: [phone, nowIso(), user.id],
    });
    await writeAudit(user.id, "UPDATE_PHONE", "Updated contact phone number");
    return NextResponse.json({ ok: true, phone_number: phone });
  } catch (error) {
    return handleError(error);
  }
}
