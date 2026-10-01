import { NextResponse } from "next/server";
import { ensureSchema, getDb, newId, nowIso } from "@/lib/db";
import { getSession, requireApproved, requireRole } from "@/lib/auth";
import { handleError, jsonError } from "@/lib/http";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await ensureSchema();
    const user = requireApproved(
      requireRole(await getSession(), ["passenger"]),
    );
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const payment_method = body.payment_method === "qr" ? "qr" : "cash";

    const tx = await getDb().transaction("write");
    try {
      const result = await tx.execute({
        sql: "SELECT * FROM rides WHERE id=?",
        args: [id],
      });
      const ride = result.rows[0];
      if (!ride) {
        await tx.rollback();
        return jsonError("Ride not found.", 404);
      }
      if (
        ride.status !== "open" ||
        Number(ride.seats_available) <= 0 ||
        new Date(String(ride.departure_at)).getTime() <= Date.now()
      ) {
        await tx.rollback();
        return jsonError("This ride is no longer available.", 409);
      }
      const old = await tx.execute({
        sql: "SELECT * FROM bookings WHERE ride_id=? AND passenger_id=?",
        args: [id, user.id],
      });
      const existing = old.rows[0];
      if (
        existing &&
        !["rejected", "cancelled"].includes(String(existing.status))
      ) {
        await tx.rollback();
        return jsonError("You already have a booking for this ride.", 409);
      }
      const bookingId = existing ? String(existing.id) : newId(),
        now = nowIso();
      if (existing)
        await tx.execute({
          sql: "UPDATE bookings SET status='pending', payment_method=?, updated_at=? WHERE id=?",
          args: [payment_method, now, bookingId],
        });
      else
        await tx.execute({
          sql: "INSERT INTO bookings VALUES (?,?,?,'pending',?,?,?)",
          args: [bookingId, id, user.id, payment_method, now, now],
        });
      await tx.execute({
        sql: "INSERT INTO audit_logs VALUES (?,?,?,?,?)",
        args: [
          newId(),
          user.id,
          "BOOK_RIDE",
          `Requested ride ${id} via ${payment_method}`,
          now,
        ],
      });
      await tx.commit();
      return NextResponse.json({ ok: true, bookingId });
    } catch (e) {
      await tx.rollback();
      throw e;
    } finally {
      tx.close();
    }
  } catch (error) {
    return handleError(error);
  }
}
