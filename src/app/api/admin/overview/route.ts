import { NextResponse } from "next/server";
import { getSession, requireRole } from "@/lib/auth";
import { ensureSchema, getDb } from "@/lib/db";
import { handleError } from "@/lib/http";
export async function GET() {
  try {
    await ensureSchema();
    requireRole(await getSession(), ["admin"]);
    const db = getDb();
    const users = await db.execute(
      "SELECT status,COUNT(*) as count FROM users WHERE role!='admin' GROUP BY status",
    );
    const rides = await db.execute("SELECT COUNT(*) as total FROM rides");
    return NextResponse.json({
      counts: Object.fromEntries(
        users.rows.map((r) => [String(r.status), Number(r.count)]),
      ),
      rides: Number(rides.rows[0].total),
    });
  } catch (e) {
    return handleError(e);
  }
}
