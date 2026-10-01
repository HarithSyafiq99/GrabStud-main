import { NextResponse } from "next/server";
import { ensureSchema, getDb } from "@/lib/db";
import { getSession, requireRole } from "@/lib/auth";
import { handleError } from "@/lib/http";

export async function GET() {
  try {
    await ensureSchema();
    requireRole(await getSession(), ["admin"]);
    const db = getDb();
    const result = await db.execute(
      `SELECT a.*, u.name as actor_name, u.email as actor_email
       FROM audit_logs a
       LEFT JOIN users u ON u.id = a.actor_id
       ORDER BY a.created_at DESC
       LIMIT 300`,
    );
    return NextResponse.json({ logs: result.rows });
  } catch (error) {
    return handleError(error);
  }
}
