import { NextResponse } from "next/server";
import { ensureSchema, getDb, newId, nowIso } from "@/lib/db";
import { getSession, requireApproved, requireRole } from "@/lib/auth";
import { handleError, jsonError } from "@/lib/http";
import { BOOKING_SELECT } from "@/lib/bookings";
import { parseLocationPin, validLocationName } from "@/lib/locations";
import { requireActiveAccount } from "@/lib/user";
export async function GET(request: Request) {
  try {
    await ensureSchema();
    const user = requireApproved(
      requireRole(await getSession(), ["driver", "passenger"]),
    );
    const query = new URL(request.url).searchParams;
    const available = user.role === "driver" && query.get("mine") !== "1";
    const latest = !available && query.get("latest") === "1";
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
          sql += " AND instr(lower(b." + column + "),lower(?))>0";
          args.push(value.trim());
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
        "=?" +
        (latest ? "" : " AND b.status IN ('pending','offered','accepted')");
      args.push(user.id);
    }
    const result = await getDb().execute({
      sql:
        sql +
        " ORDER BY b.created_at DESC,b.id DESC" +
        (latest ? " LIMIT 1" : ""),
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
      fromInput = body.from_zone,
      toInput = body.to_zone;
    if (!validLocationName(fromInput) || !validLocationName(toInput))
      return jsonError(
        "Enter a pickup and destination name with 2 to 160 characters.",
      );
    const from = fromInput.trim(),
      to = toInput.trim();
    let pickup, destination;
    try {
      pickup = parseLocationPin(body.pickup_lat, body.pickup_lng);
      destination = parseLocationPin(
        body.destination_lat,
        body.destination_lng,
      );
    } catch (error) {
      return jsonError((error as Error).message);
    }
    if (
      (pickup &&
        destination &&
        pickup.lat === destination.lat &&
        pickup.lng === destination.lng) ||
      (from.toLowerCase() === to.toLowerCase() && (!pickup || !destination))
    )
      return jsonError("Choose different pickup and destination locations.");
    const departure = new Date(String(body.departure_at ?? ""));
    if (Number.isNaN(departure.getTime()) || departure.getTime() <= Date.now())
      return jsonError("Choose a departure time later than the current time.");
    const payment = body.payment_method ?? "cash";
    if (!["cash", "qr"].includes(payment))
      return jsonError("Choose cash or QR payment.");
    const pickupNote = body.pickup_note ?? "";
    const passengerCount =
      body.passenger_count === undefined ? 1 : body.passenger_count;
    if (
      !Number.isInteger(passengerCount) ||
      passengerCount < 1 ||
      passengerCount > 4
    )
      return jsonError(
        "Choose between 1 and 4 passengers, including yourself.",
      );
    if (typeof pickupNote !== "string" || pickupNote.trim().length > 300)
      return jsonError(
        "Pickup remarks must be text with at most 300 characters.",
      );
    const tx = await getDb().transaction("write");
    try {
      await requireActiveAccount(tx, user);
      const existing = await tx.execute({
        sql: "SELECT id FROM bookings WHERE passenger_id=? AND lower(from_zone)=lower(?) AND lower(to_zone)=lower(?) AND departure_at=? AND pickup_lat IS ? AND pickup_lng IS ? AND destination_lat IS ? AND destination_lng IS ? AND status IN ('pending','offered','accepted')",
        args: [
          user.id,
          from,
          to,
          departure.toISOString(),
          pickup?.lat ?? null,
          pickup?.lng ?? null,
          destination?.lat ?? null,
          destination?.lng ?? null,
        ],
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
        sql: "INSERT INTO bookings (id,passenger_id,passenger_count,from_zone,to_zone,departure_at,status,payment_method,pickup_note,pickup_lat,pickup_lng,destination_lat,destination_lng,created_at,updated_at) VALUES (?,?,?,?,?,?,'pending',?,?,?,?,?,?,?,?)",
        args: [
          id,
          user.id,
          passengerCount,
          from,
          to,
          departure.toISOString(),
          payment,
          pickupNote.trim(),
          pickup?.lat ?? null,
          pickup?.lng ?? null,
          destination?.lat ?? null,
          destination?.lng ?? null,
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
          from +
            " to " +
            to +
            " at " +
            departure.toISOString() +
            " · " +
            passengerCount +
            " passenger(s)",
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
