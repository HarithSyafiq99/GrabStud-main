import { NextResponse } from "next/server";
import { ensureSchema, getDb } from "@/lib/db";
import { getSession, requireApproved, requireRole } from "@/lib/auth";
import { handleError } from "@/lib/http";
import { BOOKING_SELECT } from "@/lib/bookings";
export async function GET() {
  try {
    await ensureSchema();
    const user = requireApproved(
      requireRole(await getSession(), ["passenger", "driver", "admin"]),
    );
    const where =
      user.role === "admin"
        ? ""
        : " WHERE " +
          (user.role === "driver" ? "b.driver_id" : "b.passenger_id") +
          "=?";
    const result = await getDb().execute({
      sql:
        BOOKING_SELECT +
        where +
        " ORDER BY b.departure_at DESC,b.created_at DESC",
      args: user.role === "admin" ? [] : [user.id],
    });
    return NextResponse.json({ history: result.rows, role: user.role });
  } catch (error) {
    return handleError(error);
  }
}
