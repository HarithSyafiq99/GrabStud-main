import { NextResponse } from "next/server";
import { ensureSchema, getDb, newId, nowIso, writeAudit } from "@/lib/db";
import { getSession, requireApproved, requireRole } from "@/lib/auth";
import { handleError, jsonError } from "@/lib/http";
import { ZONES, getFlatRate, MAX_SEATS } from "@/lib/zones";

export async function GET(request: Request) {
  try {
    await ensureSchema();
    const user = requireApproved(
      requireRole(await getSession(), ["passenger", "driver", "admin"]),
    );
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const date = searchParams.get("date");
    const mine = searchParams.get("mine") === "1";

    const db = getDb();
    let sql = `SELECT r.*, u.name as driver_name, (SELECT b.status FROM bookings b WHERE b.ride_id=r.id AND b.passenger_id=?) as booking_status
               FROM rides r
               JOIN users u ON u.id = r.driver_id
               WHERE 1=1`;
    const args: (string | number)[] = [user.id];

    if (mine && user.role === "driver") {
      sql += " AND r.driver_id = ?";
      args.push(user.id);
    } else {
      sql += " AND r.status IN ('open', 'full') AND r.departure_at > ?";
      args.push(nowIso());
    }

    if (from) {
      sql += " AND r.from_zone = ?";
      args.push(from);
    }
    if (to) {
      sql += " AND r.to_zone = ?";
      args.push(to);
    }
    if (date) {
      sql += " AND date(r.departure_at, '+8 hours') = date(?)";
      args.push(date);
    }

    sql += " ORDER BY r.departure_at ASC";
    const result = await db.execute({ sql, args });
    return NextResponse.json({ rides: result.rows });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: Request) {
  try {
    await ensureSchema();
    const user = requireApproved(requireRole(await getSession(), ["driver"]));
    const body = await request.json();
    const from_zone = String(body.from_zone ?? "");
    const to_zone = String(body.to_zone ?? "");
    const departure_at = String(body.departure_at ?? "");
    const seats_total = Number(body.seats_total ?? 0);

    if (!ZONES.includes(from_zone as (typeof ZONES)[number])) {
      return jsonError("Invalid origin zone.");
    }
    if (!ZONES.includes(to_zone as (typeof ZONES)[number])) {
      return jsonError("Invalid destination zone.");
    }
    if (from_zone === to_zone)
      return jsonError("Origin and destination must differ.");
    if (
      !Number.isInteger(seats_total) ||
      seats_total < 1 ||
      seats_total > MAX_SEATS
    ) {
      return jsonError(`Seats must be between 1 and ${MAX_SEATS}.`);
    }

    const departure = new Date(departure_at);
    if (Number.isNaN(departure.getTime()))
      return jsonError("Invalid departure time.");
    if (departure.getTime() <= Date.now()) {
      return jsonError("Departure time must be later than the current time.");
    }

    const flat_rate = getFlatRate(from_zone, to_zone);
    const id = newId();
    const db = getDb();
    await db.execute({
      sql: `INSERT INTO rides
            (id, driver_id, from_zone, to_zone, departure_at, seats_total, seats_available, flat_rate, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)`,
      args: [
        id,
        user.id,
        from_zone,
        to_zone,
        departure.toISOString(),
        seats_total,
        seats_total,
        flat_rate,
        nowIso(),
      ],
    });
    await writeAudit(
      user.id,
      "CREATE_RIDE",
      `${from_zone} → ${to_zone} at ${departure.toISOString()} seats=${seats_total} rate=RM${flat_rate}`,
    );
    return NextResponse.json({ ok: true, id, flat_rate });
  } catch (error) {
    return handleError(error);
  }
}
