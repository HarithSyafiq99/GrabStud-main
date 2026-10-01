import { NextResponse } from "next/server";
import { ensureSchema, getDb } from "@/lib/db";
import { getSession, requireApproved, requireRole } from "@/lib/auth";
import { handleError } from "@/lib/http";

export async function GET() {
  try {
    await ensureSchema();
    const user = requireApproved(requireRole(await getSession(), ["driver"]));
    const db = getDb();
    const result = await db.execute({
      sql: `SELECT b.*, u.name as passenger_name, u.email as passenger_email,
                   u.student_number as passenger_student_number,
                   r.from_zone, r.to_zone, r.departure_at, r.flat_rate, r.seats_available
            FROM bookings b
            JOIN users u ON u.id = b.passenger_id
            JOIN rides r ON r.id = b.ride_id
            WHERE r.driver_id = ? AND b.status = 'pending'
            ORDER BY b.created_at DESC`,
      args: [user.id],
    });
    return NextResponse.json({ bookings: result.rows });
  } catch (error) {
    return handleError(error);
  }
}
