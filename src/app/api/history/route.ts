import { NextResponse } from "next/server";
import { ensureSchema, getDb } from "@/lib/db";
import { getSession, requireApproved, requireRole } from "@/lib/auth";
import { handleError } from "@/lib/http";

export async function GET() {
  try {
    await ensureSchema();
    const user = requireApproved(
      requireRole(await getSession(), ["passenger", "driver", "admin"]),
    );
    const db = getDb();

    if (user.role === "admin") {
      const result = await db.execute(
        `SELECT b.*,r.from_zone,r.to_zone,r.departure_at,r.flat_rate,r.status as ride_status,d.name as driver_name,p.name as passenger_name FROM bookings b JOIN rides r ON r.id=b.ride_id JOIN users d ON d.id=r.driver_id JOIN users p ON p.id=b.passenger_id ORDER BY r.departure_at DESC`,
      );
      return NextResponse.json({ history: result.rows, role: user.role });
    }
    if (user.role === "driver") {
      const result = await db.execute({
        sql: `SELECT b.*, u.name as passenger_name, r.from_zone, r.to_zone,
                     r.departure_at, r.flat_rate, r.status as ride_status
              FROM bookings b
              JOIN rides r ON r.id = b.ride_id
              JOIN users u ON u.id = b.passenger_id
              WHERE r.driver_id = ?
              ORDER BY r.departure_at DESC`,
        args: [user.id],
      });
      return NextResponse.json({ history: result.rows, role: user.role });
    }

    const result = await db.execute({
      sql: `SELECT b.*, r.from_zone, r.to_zone, r.departure_at, r.flat_rate,
                   r.status as ride_status, d.name as driver_name
            FROM bookings b
            JOIN rides r ON r.id = b.ride_id
            JOIN users d ON d.id = r.driver_id
            WHERE b.passenger_id = ?
            ORDER BY r.departure_at DESC`,
      args: [user.id],
    });
    return NextResponse.json({ history: result.rows, role: user.role });
  } catch (error) {
    return handleError(error);
  }
}
