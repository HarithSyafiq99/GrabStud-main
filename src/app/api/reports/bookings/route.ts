import { ensureSchema, getDb } from "@/lib/db";
import { getSession, requireApproved, requireRole } from "@/lib/auth";
import { handleError } from "@/lib/http";
import {
  createBookingPdf,
  REPORT_BOOKING_SELECT,
  type ReportBooking,
} from "@/lib/booking-reports";
export const runtime = "nodejs";
export async function GET() {
  try {
    await ensureSchema();
    const user = requireApproved(
      requireRole(await getSession(), ["passenger", "driver", "admin"]),
    );
    const where =
      user.role === "admin"
        ? ""
        : ` WHERE b.${user.role === "driver" ? "driver_id" : "passenger_id"}=?`;
    const result = await getDb().execute({
      sql:
        REPORT_BOOKING_SELECT + where + " ORDER BY b.created_at DESC,b.id DESC",
      args: user.role === "admin" ? [] : [user.id],
    });
    const pdf = await createBookingPdf(
      result.rows as unknown as ReportBooking[],
      { name: user.name, role: user.role },
    );
    return new Response(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="grabstudent-bookings-${user.role}.pdf"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return handleError(error);
  }
}
