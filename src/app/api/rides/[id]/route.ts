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
    const user = requireApproved(requireRole(await getSession(), ["driver"]));
    const { id } = await params;
    const { action } = await request.json();
    if (!["complete", "cancel"].includes(action))
      return jsonError("Invalid action.");
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
      if (ride.driver_id !== user.id) {
        await tx.rollback();
        return jsonError("Forbidden", 403);
      }
      if (!["open", "full"].includes(String(ride.status))) {
        await tx.rollback();
        return jsonError("Ride already closed.", 409);
      }
      if (
        action === "complete" &&
        new Date(String(ride.departure_at)).getTime() > Date.now()
      ) {
        await tx.rollback();
        return jsonError("Complete the ride after its departure time.");
      }
      const status = action === "complete" ? "completed" : "cancelled",
        now = nowIso();
      await tx.execute({
        sql: "UPDATE rides SET status=? WHERE id=?",
        args: [status, id],
      });
      await tx.execute({
        sql: "UPDATE bookings SET status=CASE WHEN status='accepted' THEN ? ELSE 'cancelled' END, updated_at=? WHERE ride_id=? AND status IN ('pending','accepted')",
        args: [status, now, id],
      });
      await tx.execute({
        sql: "INSERT INTO audit_logs VALUES (?,?,?,?,?)",
        args: [
          newId(),
          user.id,
          `${action.toUpperCase()}_RIDE`,
          `Ride ${id} ${status}`,
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
