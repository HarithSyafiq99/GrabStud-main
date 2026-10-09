import { NextResponse } from "next/server";
import { ensureSchema, getDb, nowIso, newId } from "@/lib/db";
import { getSession, requireApproved, requireRole } from "@/lib/auth";
import { handleError, jsonError } from "@/lib/http";
import { validProfilePhoto, validVehicle } from "@/lib/profile";
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
      { action, price, quoted_price, driver_id, pickup_note } =
        await request.json();
    if (
      ![
        "accept",
        "reject",
        "confirm",
        "decline",
        "cancel",
        "withdraw",
        "complete",
        "arrive",
        "acknowledge",
        "remark",
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
      if (["arrive", "acknowledge", "remark"].includes(action)) {
        if (action === "arrive" ? !driver : !passenger)
          return await fail("Forbidden", 403);
        if (
          action === "remark"
            ? !["pending", "offered", "accepted"].includes(String(b.status))
            : b.status !== "accepted"
        )
          return await fail("This booking is no longer active.", 409);
        if (
          action !== "remark" &&
          b.ride_id != null &&
          !["open", "full"].includes(String(b.ride_status))
        )
          return await fail("This ride is closed.", 409);
        if (action === "acknowledge" && !b.arrived_at)
          return await fail(
            "Your driver has not sent an arrival reminder yet.",
            409,
          );
        if (
          action === "remark" &&
          (typeof pickup_note !== "string" || pickup_note.trim().length > 300)
        )
          return await fail(
            "Pickup remarks must be text with at most 300 characters.",
          );
        const now = nowIso();
        const updated = await tx.execute({
          sql:
            action === "remark"
              ? "UPDATE bookings SET pickup_note=?,updated_at=? WHERE id=?"
              : action === "arrive"
                ? "UPDATE bookings SET arrived_at=?,updated_at=? WHERE id=? AND arrived_at IS NULL"
                : "UPDATE bookings SET arrival_acknowledged_at=?,updated_at=? WHERE id=? AND arrival_acknowledged_at IS NULL",
          args: [action === "remark" ? pickup_note.trim() : now, now, id],
        });
        if (updated.rowsAffected)
          await tx.execute({
            sql: "INSERT INTO audit_logs VALUES (?,?,?,?,?)",
            args: [
              newId(),
              user.id,
              action.toUpperCase() + "_BOOKING",
              "Pickup coordination for booking " + id,
              now,
            ],
          });
        await tx.commit();
        return NextResponse.json({ ok: true });
      }
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
        if (!validProfilePhoto(user.profile_photo) || !validVehicle(user))
          return await fail(
            "Add your profile photo and car details in My profile before choosing a passenger.",
          );
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
        sql: "UPDATE bookings SET status=?,driver_id=?,quoted_price=?,arrived_at=CASE WHEN ?='completed' THEN arrived_at ELSE NULL END,arrival_acknowledged_at=CASE WHEN ?='completed' THEN arrival_acknowledged_at ELSE NULL END,updated_at=? WHERE id=?",
        args: [status, driverId, quote, status, status, now, id],
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
