import { NextResponse } from "next/server";
import { ensureSchema, getDb, newId, nowIso } from "@/lib/db";
import { getSession, requireApproved, requireRole } from "@/lib/auth";
import { handleError, jsonError } from "@/lib/http";
import { BOOKING_SELECT } from "@/lib/bookings";
import { ZONES } from "@/lib/zones";
export async function GET(request: Request) {
  try {
    await ensureSchema();
    const user = requireApproved(
      requireRole(await getSession(), ["driver", "passenger"]),
    );
    const query = new URL(request.url).searchParams;
    const available = user.role === "driver" && query.get("mine") !== "1";
    let sql = BOOKING_SELECT;
    const args: string[] = [];
    if (available) {
      sql +=
        " WHERE b.status='pending' AND (b.driver_id IS NULL OR b.driver_id=?) AND b.departure_at>? AND (b.ride_id IS NULL OR (r.status='open' AND r.seats_available>0))";
      args.push(user.id, nowIso());
      for (const [parameter, column] of [
        ["from", "from_zone"],
        ["to", "to_zone"],
      ]) {
        const value = query.get(parameter);
        if (value) {
          sql += " AND b." + column + "=?";
          args.push(value);
        }
      }
      const date = query.get("date");
      if (date) {
        sql += " AND date(b.departure_at,'+8 hours')=date(?)";
        args.push(date);
      }
    } else {
      sql +=
        " WHERE " +
        (user.role === "driver" ? "b.driver_id" : "b.passenger_id") +
        "=? AND b.status IN ('pending','offered','accepted')";
      args.push(user.id);
    }
    const result = await getDb().execute({
      sql: sql + " ORDER BY b.departure_at ASC,b.created_at ASC",
      args,
    });
    return NextResponse.json({ bookings: result.rows });
  } catch (error) {
    return handleError(error);
  }
}
export async function POST(request: Request) {
  try {
    await ensureSchema();
    const user = requireApproved(
      requireRole(await getSession(), ["passenger"]),
    );
    const body = await request.json(),
      from = String(body.from_zone ?? ""),
      to = String(body.to_zone ?? "");
    if (
      !ZONES.includes(from as (typeof ZONES)[number]) ||
      !ZONES.includes(to as (typeof ZONES)[number])
    )
      return jsonError("Choose a valid pickup and destination.");
    if (from === to) return jsonError("Pickup and destination must differ.");
    const departure = new Date(String(body.departure_at ?? ""));
    if (Number.isNaN(departure.getTime()) || departure.getTime() <= Date.now())
      return jsonError("Choose a departure time later than the current time.");
    const payment = body.payment_method ?? "cash";
    if (!["cash", "qr"].includes(payment))
      return jsonError("Choose cash or QR payment.");
    const pickupNote = body.pickup_note ?? "";
    if (typeof pickupNote !== "string" || pickupNote.trim().length > 300)
      return jsonError(
        "Pickup remarks must be text with at most 300 characters.",
      );
    const tx = await getDb().transaction("write");
    try {
      const existing = await tx.execute({
        sql: "SELECT id FROM bookings WHERE passenger_id=? AND from_zone=? AND to_zone=? AND departure_at=? AND status IN ('pending','offered','accepted')",
        args: [user.id, from, to, departure.toISOString()],
      });
      if (existing.rows.length) {
        await tx.rollback();
        return jsonError(
          "You already have an active request for this journey and time.",
          409,
        );
      }
      const id = newId(),
        now = nowIso();
      // Passenger input cannot assign a driver, confirm a booking or set its price.
      await tx.execute({
        sql: "INSERT INTO bookings (id,passenger_id,from_zone,to_zone,departure_at,status,payment_method,pickup_note,created_at,updated_at) VALUES (?,?,?,?,?,'pending',?,?,?,?)",
        args: [
          id,
          user.id,
          from,
          to,
          departure.toISOString(),
          payment,
          pickupNote.trim(),
          now,
          now,
        ],
      });
      await tx.execute({
        sql: "INSERT INTO audit_logs VALUES (?,?,?,?,?)",
        args: [
          newId(),
          user.id,
          "REQUEST_BOOKING",
          from + " to " + to + " at " + departure.toISOString(),
          now,
        ],
      });
      await tx.commit();
      return NextResponse.json({ ok: true, bookingId: id, status: "pending" });
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
