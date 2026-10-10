import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { createBookingPdf } from "@/lib/booking-reports";
import type { Role } from "@/lib/types";
import { ensureSchema, getDb } from "@/lib/db";
import { getSession, requireApproved, requireRole } from "@/lib/auth";
import { handleError, jsonError } from "@/lib/http";

export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    await ensureSchema();
    const user = requireApproved(
      requireRole(await getSession(), ["passenger", "driver", "admin"]),
    );
    const query = new URL(request.url).searchParams;
    const month = query.get("month"),
      role = query.get("role");
    const where =
      user.role === "admin"
        ? "owner_id IS NULL AND audience_role='admin'"
        : "owner_id=?";
    const args = user.role === "admin" ? [] : [user.id];
    if (!month) {
      const result = await getDb().execute({
        sql:
          "SELECT month,audience_role AS role,SUM(booking_count) AS booking_count,MAX(created_at) AS created_at FROM monthly_booking_reports WHERE " +
          where +
          " GROUP BY month,audience_role ORDER BY month DESC,audience_role",
        args,
      });
      const mode = process.env.BOOKING_RETENTION_MODE ?? "all";
      const retention =
        (process.env.CRON_SECRET?.length ?? 0) >= 32 &&
        (mode === "all" || mode === "closed")
          ? mode
          : null;
      return Response.json(
        { reports: result.rows, retention },
        { headers: { "Cache-Control": "private, no-store" } },
      );
    }
    if (
      !/^\d{4}-(0[1-9]|1[0-2])$/.test(month) ||
      !role ||
      !["passenger", "driver", "admin"].includes(role)
    )
      return jsonError("Choose a valid month and report.");
    const result = await getDb().execute({
      sql:
        "SELECT pdf_data,booking_count FROM monthly_booking_reports WHERE " +
        where +
        " AND month=? AND audience_role=? ORDER BY latest_booking_at DESC,latest_booking_id DESC,created_at DESC,id DESC",
      args: [...args, month, role],
    });
    if (!result.rows.length)
      return jsonError("No archived report is available for this month.", 404);
    const headers = {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="grabstudent-${month}-${role}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    };
    if (result.rows.length === 1)
      return new Response(
        Buffer.from(new Uint8Array(result.rows[0].pdf_data as ArrayBuffer)),
        { headers },
      );
    const cover = await createBookingPdf([], {
      name: user.name,
      role: role as Role,
      month,
      archived: true,
      archiveSummary: {
        bookings: result.rows.reduce(
          (sum, r) => sum + Number(r.booking_count),
          0,
        ),
        parts: result.rows.length,
      },
    });
    const pdf = await PDFDocument.load(cover);
    for (const [index, row] of result.rows.entries()) {
      const bytes = new Uint8Array(row.pdf_data as ArrayBuffer);
      const saved = await PDFDocument.load(bytes);
      for (const page of await pdf.copyPages(saved, saved.getPageIndices()))
        pdf.addPage(page);
      // Original parts retain their exact-record JSON attachments when PDFs are combined.
      await pdf.attach(bytes, `grabstudent-${month}-part-${index + 1}.pdf`, {
        mimeType: "application/pdf",
      });
    }
    pdf.setTitle(`GrabStudent ${month} ${role} monthly report`);
    pdf.setAuthor("GrabStudent");
    const footer = await pdf.embedFont(StandardFonts.Helvetica),
      pages = pdf.getPages();
    for (const [index, page] of pages.entries()) {
      page.drawRectangle({
        x: 40,
        y: 24,
        width: 515,
        height: 14,
        color: rgb(1, 1, 1),
      });
      page.drawText(`GrabStudent | Page ${index + 1} of ${pages.length}`, {
        x: 42,
        y: 28,
        size: 8,
        font: footer,
        color: rgb(0.46, 0.43, 0.53),
      });
    }
    return new Response(Buffer.from(await pdf.save()), {
      headers,
    });
  } catch (error) {
    return handleError(error);
  }
}
