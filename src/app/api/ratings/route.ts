import { NextResponse } from "next/server";
import { getSession, requireApproved, requireRole } from "@/lib/auth";
import { ensureSchema, getDb } from "@/lib/db";
import { handleError } from "@/lib/http";

export async function GET() {
  try {
    await ensureSchema();
    const user = requireApproved(requireRole(await getSession(), ["driver"]));
    const summary = await getDb().execute({
      sql: "SELECT AVG(rating_score) AS average,COUNT(*) AS count FROM bookings WHERE driver_id=? AND rated_at IS NOT NULL",
      args: [user.id],
    });
    const reviews = await getDb().execute({
      sql: "SELECT id,rating_score,rating_feedback,rated_at FROM bookings WHERE driver_id=? AND rated_at IS NOT NULL ORDER BY rated_at DESC,id DESC LIMIT 10",
      args: [user.id],
    });
    return NextResponse.json({ ...summary.rows[0], reviews: reviews.rows });
  } catch (error) {
    return handleError(error);
  }
}
