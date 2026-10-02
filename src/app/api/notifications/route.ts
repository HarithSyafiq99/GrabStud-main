import { NextResponse } from "next/server";
import { ensureSchema, getDb, nowIso } from "@/lib/db";
import { getSession, requireApproved, requireRole } from "@/lib/auth";
import { handleError } from "@/lib/http";
export async function GET() {
  try {
    await ensureSchema();
    const user = requireApproved(
      requireRole(await getSession(), ["passenger", "driver"]),
    );
    const result = await getDb().execute({
      sql:
        user.role === "driver"
          ? "SELECT SUM(CASE WHEN b.status='pending' AND (b.driver_id IS NULL OR b.driver_id=?) AND b.departure_at>? AND (b.ride_id IS NULL OR (r.status='open' AND r.seats_available>0)) THEN 1 ELSE 0 END) as pending,SUM(CASE WHEN b.driver_id=? AND b.status='offered' AND b.departure_at>? THEN 1 ELSE 0 END) as offers,SUM(CASE WHEN b.driver_id=? AND b.status='accepted' THEN 1 ELSE 0 END) as booked FROM bookings b LEFT JOIN rides r ON r.id=b.ride_id"
          : "SELECT SUM(CASE WHEN status='pending' AND departure_at>? THEN 1 ELSE 0 END) as pending,SUM(CASE WHEN status='offered' AND departure_at>? THEN 1 ELSE 0 END) as offers,SUM(CASE WHEN status='accepted' THEN 1 ELSE 0 END) as booked FROM bookings WHERE passenger_id=?",
      args:
        user.role === "driver"
          ? [user.id, nowIso(), user.id, nowIso(), user.id]
          : [nowIso(), nowIso(), user.id],
    });
    const row = result.rows[0];
    return NextResponse.json({
      pendingRequests: Number(row?.pending ?? 0),
      priceOffers: Number(row?.offers ?? 0),
      acceptedBookings: Number(row?.booked ?? 0),
    });
  } catch (error) {
    return handleError(error);
  }
}
