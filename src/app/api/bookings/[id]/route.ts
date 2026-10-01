import { NextResponse } from "next/server";
import { ensureSchema, getDb, nowIso, newId } from "@/lib/db";
import { getSession, requireApproved, requireRole } from "@/lib/auth";
import { handleError, jsonError } from "@/lib/http";
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await ensureSchema();
    const user = requireApproved(
      requireRole(await getSession(), ["driver", "passenger"]),
    );
    const { id } = await params;
    const { action } = await request.json();
    if (!["accept", "reject", "cancel"].includes(action))
      return jsonError("Invalid action.");
    const tx = await getDb().transaction("write");
    try {
      const r = await tx.execute({
        sql: `SELECT b.*, r.driver_id, r.departure_at, r.seats_available, r.status as ride_status FROM bookings b JOIN rides r ON r.id=b.ride_id WHERE b.id=?`,
        args: [id],
      });
      const b = r.rows[0];
      if (!b) {
        await tx.rollback();
        return jsonError("Booking not found.", 404);
      }
      const owner =
        action === "cancel"
          ? user.role === "passenger" && b.passenger_id === user.id
          : user.role === "driver" && b.driver_id === user.id;
      if (!owner) {
        await tx.rollback();
        return jsonError("Forbidden", 403);
      }
      const live = ["open", "full"].includes(String(b.ride_status));
      if (
        !live ||
        (action !== "reject" &&
          new Date(String(b.departure_at)).getTime() <= Date.now())
      ) {
        await tx.rollback();
        return jsonError("This ride has departed or is closed.");
      }
      if (
        action === "cancel"
          ? !["pending", "accepted"].includes(String(b.status))
          : b.status !== "pending"
      ) {
        await tx.rollback();
        return jsonError("This booking was already processed.", 409);
      }
      const now = nowIso();
      const status =
        action === "accept"
          ? "accepted"
          : action === "reject"
            ? "rejected"
            : "cancelled";
      if (action === "accept") {
        const updated = await tx.execute({
          sql: `UPDATE rides SET seats_available=seats_available-1, status=CASE WHEN seats_available=1 THEN 'full' ELSE 'open' END WHERE id=? AND seats_available>0 AND status='open'`,
          args: [String(b.ride_id)],
        });
        if (!updated.rowsAffected) {
          await tx.rollback();
          return jsonError("No seats remaining.", 409);
        }
      } else if (action === "cancel" && b.status === "accepted") {
        await tx.execute({
          sql: "UPDATE rides SET seats_available=MIN(seats_total,seats_available+1), status='open' WHERE id=?",
          args: [String(b.ride_id)],
        });
      }
      await tx.execute({
        sql: "UPDATE bookings SET status=?, updated_at=? WHERE id=?",
        args: [status, now, id],
      });
      await tx.execute({
        sql: "INSERT INTO audit_logs VALUES (?,?,?,?,?)",
        args: [
          newId(),
          user.id,
          `${action.toUpperCase()}_BOOKING`,
          `Booking ${id} ${status}`,
          now,
        ],
      });
      await tx.commit();
      return NextResponse.json({ ok: true, status });
    } catch (e) {
      await tx.rollback();
      throw e;
    } finally {
      tx.close();
    }
  } catch (e) {
    return handleError(e);
  }
}
