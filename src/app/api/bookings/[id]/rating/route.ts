import { NextResponse } from "next/server";
import { getSession, requireApproved, requireRole } from "@/lib/auth";
import { ensureSchema, getDb, newId, nowIso } from "@/lib/db";
import { handleError, jsonError } from "@/lib/http";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await ensureSchema();
    const user = requireApproved(
      requireRole(await getSession(), ["passenger"]),
    );
    const { id } = await context.params;
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body))
      return jsonError("Enter a rating and optional feedback.");
    const { score, feedback = "", confirm_finished } = body;
    if (
      typeof score !== "number" ||
      !Number.isInteger(score) ||
      score < 1 ||
      score > 5
    )
      return jsonError("Choose a rating from 1 to 5 stars.");
    if (typeof feedback !== "string" || feedback.length > 500)
      return jsonError("Keep feedback within 500 characters.");
    const tx = await getDb().transaction("write");
    try {
      const result = await tx.execute({
        sql: "SELECT b.*,r.status AS ride_status FROM bookings b LEFT JOIN rides r ON r.id=b.ride_id WHERE b.id=? AND b.passenger_id=?",
        args: [id, user.id],
      });
      const booking = result.rows[0];
      if (!booking) {
        await tx.rollback();
        return jsonError("Booking not found.", 404);
      }
      if (booking.rated_at) {
        await tx.rollback();
        return jsonError("You have already rated this ride.", 409);
      }
      const arrivedRide =
        booking.status === "accepted" &&
        !!booking.arrived_at &&
        new Date(String(booking.departure_at)).getTime() <= Date.now() &&
        (booking.ride_id == null ||
          ["open", "full"].includes(String(booking.ride_status)));
      if (
        !booking.driver_id ||
        (booking.status !== "completed" &&
          !(arrivedRide && confirm_finished === true))
      ) {
        await tx.rollback();
        return jsonError("Rate your driver after the ride has finished.", 409);
      }
      const timestamp = nowIso();
      const saved = await tx.execute({
        sql: "UPDATE bookings SET status='completed',rating_score=?,rating_feedback=?,rated_at=?,updated_at=? WHERE id=? AND passenger_id=? AND rated_at IS NULL",
        args: [score, feedback.trim(), timestamp, timestamp, id, user.id],
      });
      if (saved.rowsAffected !== 1) {
        await tx.rollback();
        return jsonError("You have already rated this ride.", 409);
      }
      await tx.execute({
        sql: "INSERT INTO audit_logs (id,actor_id,action,details,created_at) VALUES (?,?,?,?,?)",
        args: [
          newId(),
          user.id,
          "RATE_DRIVER",
          `Booking ${id}: ${score} stars; ride completed`,
          timestamp,
        ],
      });
      await tx.commit();
      return NextResponse.json({ ok: true, status: "completed" });
    } catch (error) {
      await tx.rollback();
      throw error;
    } finally {
      tx.close();
    }
  } catch (error) {
    return handleError(error);
  }
}
