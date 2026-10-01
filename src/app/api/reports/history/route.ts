import { ensureSchema, getDb } from "@/lib/db";
import { getSession, requireApproved, requireRole } from "@/lib/auth";
import { handleError } from "@/lib/http";

function csvEscape(value: unknown) {
  const raw = value == null ? "" : String(value);
  const text = /^[=+@\-\t\r]/.test(raw) ? "\'" + raw : raw;
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export async function GET() {
  try {
    await ensureSchema();
    const user = requireApproved(
      requireRole(await getSession(), ["passenger", "driver", "admin"]),
    );
    const db = getDb();

    let rows;
    if (user.role === "admin") {
      const result = await db.execute(
        `SELECT b.id, b.status, b.payment_method, b.created_at,
                r.from_zone, r.to_zone, r.departure_at, r.flat_rate,
                d.name as driver_name, p.name as passenger_name
         FROM bookings b
         JOIN rides r ON r.id = b.ride_id
         JOIN users d ON d.id = r.driver_id
         JOIN users p ON p.id = b.passenger_id
         ORDER BY b.created_at DESC`,
      );
      rows = result.rows;
    } else if (user.role === "driver") {
      const result = await db.execute({
        sql: `SELECT b.id, b.status, b.payment_method, b.created_at,
                     r.from_zone, r.to_zone, r.departure_at, r.flat_rate,
                     p.name as passenger_name
              FROM bookings b
              JOIN rides r ON r.id = b.ride_id
              JOIN users p ON p.id = b.passenger_id
              WHERE r.driver_id = ?
              ORDER BY b.created_at DESC`,
        args: [user.id],
      });
      rows = result.rows;
    } else {
      const result = await db.execute({
        sql: `SELECT b.id, b.status, b.payment_method, b.created_at,
                     r.from_zone, r.to_zone, r.departure_at, r.flat_rate,
                     d.name as driver_name
              FROM bookings b
              JOIN rides r ON r.id = b.ride_id
              JOIN users d ON d.id = r.driver_id
              WHERE b.passenger_id = ?
              ORDER BY b.created_at DESC`,
        args: [user.id],
      });
      rows = result.rows;
    }

    const headers = Object.keys(
      rows[0] ?? {
        id: "",
        status: "",
        payment_method: "",
        created_at: "",
        from_zone: "",
        to_zone: "",
        departure_at: "",
        flat_rate: "",
      },
    );
    const lines = [
      headers.join(","),
      ...rows.map((row) => headers.map((h) => csvEscape(row[h])).join(",")),
    ];
    const csv = lines.join("\n");
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="grabstudent-history-${user.role}.csv"`,
      },
    });
  } catch (error) {
    return handleError(error);
  }
}
