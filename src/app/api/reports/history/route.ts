import { ensureSchema, getDb } from "@/lib/db";
import { getSession, requireApproved, requireRole } from "@/lib/auth";
import { handleError } from "@/lib/http";
function csvEscape(value: unknown) {
  const raw = value == null ? "" : String(value);
  const text = /^[=+@\-\t\r]/.test(raw) ? "'" + raw : raw;
  return /[",\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}
export async function GET() {
  try {
    await ensureSchema();
    const user = requireApproved(
      requireRole(await getSession(), ["passenger", "driver", "admin"]),
    );
    const where =
      user.role === "admin"
        ? ""
        : " WHERE " +
          (user.role === "driver" ? "b.driver_id" : "b.passenger_id") +
          "=?";
    const result = await getDb().execute({
      sql:
        "SELECT b.id,b.status,b.payment_method,b.created_at,b.from_zone,b.to_zone,b.departure_at,b.quoted_price/100.0 as fare_rm,d.name as driver_name,p.name as passenger_name,b.passenger_count FROM bookings b JOIN users p ON p.id=b.passenger_id LEFT JOIN users d ON d.id=b.driver_id" +
        where +
        " ORDER BY b.created_at DESC,b.id DESC",
      args: user.role === "admin" ? [] : [user.id],
    });
    const headers = [
      "id",
      "status",
      "payment_method",
      "created_at",
      "from_zone",
      "to_zone",
      "departure_at",
      "fare_rm",
      "driver_name",
      "passenger_name",
      "passenger_count",
    ];
    const csv = [
      headers.join(","),
      ...result.rows.map((row) =>
        headers.map((h) => csvEscape(row[h])).join(","),
      ),
    ].join("\n");
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition":
          'attachment; filename="grabstudent-history-' + user.role + '.csv"',
      },
    });
  } catch (error) {
    return handleError(error);
  }
}
