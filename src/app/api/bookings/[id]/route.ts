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
    const { id } = await params,
      { action, price, quoted_price, driver_id } = await request.json();
    if (
      ![
        "accept",
        "reject",
        "confirm",
        "decline",
        "cancel",
        "withdraw",
        "complete",
      ].includes(action)
    )
      return jsonError("Invalid action.");
    const tx = await getDb().transaction("write");
    try {
      const result = await tx.execute({
        sql: "SELECT b.*,r.status as ride_status,r.seats_available FROM bookings b LEFT JOIN rides r ON r.id=b.ride_id WHERE b.id=?",
        args: [id],
      });
      const b = result.rows[0],
        fail = async (message: string, status = 400) => {
          await tx.rollback();
          return jsonError(message, status);
        };
      if (!b) return await fail("Booking not found.", 404);
      const passenger = user.role === "passenger" && b.passenger_id === user.id,
        driver = user.role === "driver" && b.driver_id === user.id;
      const claim =
        action === "accept" &&
        user.role === "driver" &&
        (b.driver_id == null || driver);
      const authorized =
        claim ||
        (["confirm", "decline"].includes(action) && passenger) ||
        (["withdraw", "complete", "reject"].includes(action) && driver) ||
        (action === "cancel" && (passenger || driver));
      if (!authorized) return await fail("Forbidden", 403);
      const allowed =
        action === "accept" || action === "reject"
          ? ["pending"]
          : ["confirm", "decline", "withdraw"].includes(action)
            ? ["offered"]
            : action === "complete"
              ? ["accepted"]
              : passenger
                ? ["pending", "offered", "accepted"]
                : ["offered", "accepted"];
      if (!allowed.includes(String(b.status)))
        return await fail("This booking was already processed.", 409);
      const departed = new Date(String(b.departure_at)).getTime() <= Date.now();
      if (action === "complete" ? !departed : departed)
        return await fail(
          action === "complete"
            ? "Complete the journey after its departure time."
            : "This request has already departed.",
        );
      if (
        b.ride_id != null &&
        !["open", "full"].includes(String(b.ride_status))
      )
        return await fail("This ride is closed.");
      let quote = b.quoted_price == null ? null : Number(b.quoted_price),
        driverId = b.driver_id == null ? null : String(b.driver_id);
      if (action === "accept") {
        if (
          typeof price !== "number" ||
          !Number.isFinite(price) ||
          price < 0.01 ||
          price > 99999.99 ||
          Math.abs(price * 100 - Math.round(price * 100)) > 0.000001
        )
          return await fail(
            "Enter a price in RM from 0.01 to 99,999.99 with at most two decimal places.",
          );
        if (b.ride_id != null && Number(b.seats_available) <= 0)
          return await fail("No seats remaining.", 409);
        quote = Math.round(price * 100);
        driverId = user.id;
      }
      if (action === "confirm" && (!quote || !driverId))
        return await fail("A driver must offer a price first.", 409);
      if (
        ["confirm", "decline"].includes(action) &&
        (quoted_price !== quote || driver_id !== driverId)
      )
        return await fail(
          "This driver or price offer changed. Refresh your requests and review the current offer.",
          409,
        );
      // Earlier bookings retain their original ride's seat accounting.
      if (action === "confirm" && b.ride_id != null) {
        const updated = await tx.execute({
          sql: "UPDATE rides SET seats_available=seats_available-1,status=CASE WHEN seats_available=1 THEN 'full' ELSE 'open' END WHERE id=? AND status='open' AND seats_available>0",
          args: [String(b.ride_id)],
        });
        if (!updated.rowsAffected)
          return await fail("No seats remaining.", 409);
      } else if (
        action === "cancel" &&
        b.status === "accepted" &&
        b.ride_id != null
      ) {
        await tx.execute({
          sql: "UPDATE rides SET seats_available=MIN(seats_total,seats_available+1),status='open' WHERE id=?",
          args: [String(b.ride_id)],
        });
      }
      const reopen =
        ["decline", "withdraw"].includes(action) && b.ride_id == null;
      if (reopen) {
        driverId = null;
        quote = null;
      }
      const status = reopen
          ? "pending"
          : action === "accept"
            ? "offered"
            : action === "confirm"
              ? "accepted"
              : action === "complete"
                ? "completed"
                : ["reject", "decline"].includes(action)
                  ? "rejected"
                  : "cancelled",
        now = nowIso();
      await tx.execute({
        sql: "UPDATE bookings SET status=?,driver_id=?,quoted_price=?,updated_at=? WHERE id=?",
        args: [status, driverId, quote, now, id],
      });
      await tx.execute({
        sql: "INSERT INTO audit_logs VALUES (?,?,?,?,?)",
        args: [
          newId(),
          user.id,
          action.toUpperCase() + "_BOOKING",
          "Booking " + id + " " + status,
          now,
        ],
      });
      await tx.commit();
      return NextResponse.json({ ok: true, status, quoted_price: quote });
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
