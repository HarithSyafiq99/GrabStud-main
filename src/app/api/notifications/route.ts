import { NextResponse } from "next/server";
import { ensureSchema, getDb } from "@/lib/db";
import { getSession, requireApproved, requireRole } from "@/lib/auth";
import { handleError } from "@/lib/http";

export async function GET() {
  try {
    await ensureSchema();
    const user = requireApproved(
      requireRole(await getSession(), ["passenger", "driver"]),
    );
    const db = getDb();

    if (user.role === "driver") {
      const pending = await db.execute({
        sql: `SELECT COUNT(*) as c FROM bookings b
              JOIN rides r ON r.id = b.ride_id
              WHERE r.driver_id = ? AND b.status = 'pending'`,
        args: [user.id],
      });
      const accepted = await db.execute({
        sql: `SELECT COUNT(*) as c FROM bookings b
              JOIN rides r ON r.id = b.ride_id
              WHERE r.driver_id = ? AND b.status = 'accepted'`,
        args: [user.id],
      });
      return NextResponse.json({
        pendingRequests: Number(pending.rows[0]?.c ?? 0),
        acceptedBookings: Number(accepted.rows[0]?.c ?? 0),
      });
    }

    const pending = await db.execute({
      sql: `SELECT COUNT(*) as c FROM bookings WHERE passenger_id = ? AND status = 'pending'`,
      args: [user.id],
    });
    const accepted = await db.execute({
      sql: `SELECT COUNT(*) as c FROM bookings WHERE passenger_id = ? AND status = 'accepted'`,
      args: [user.id],
    });
    return NextResponse.json({
      pendingRequests: Number(pending.rows[0]?.c ?? 0),
      acceptedBookings: Number(accepted.rows[0]?.c ?? 0),
    });
  } catch (error) {
    return handleError(error);
  }
}
