import { NextResponse } from "next/server";
import { createSession, getSession } from "@/lib/auth";
import { ensureSchema, getDb } from "@/lib/db";
import { jsonError } from "@/lib/http";
import type { Role, UserStatus } from "@/lib/types";

export async function GET() {
  const session = await getSession();
  if (!session) return jsonError("Unauthorized", 401);
  await ensureSchema();
  const db = getDb();
  const result = await db.execute({
    sql: "SELECT id, name, email, role, status FROM users WHERE id = ?",
    args: [session.id],
  });
  const row = result.rows[0];
  if (!row) return jsonError("Unauthorized", 401);
  const user = {
    id: String(row.id),
    name: String(row.name),
    email: String(row.email),
    role: row.role as Role,
    status: row.status as UserStatus,
  };
  await createSession(user);
  return NextResponse.json({ user });
}
