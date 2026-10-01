import { ensureSchema, getDb } from "@/lib/db";
import { getSession, requireRole } from "@/lib/auth";
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
    requireRole(await getSession(), ["admin"]);
    const db = getDb();
    const result = await db.execute(
      `SELECT a.created_at, a.action, a.details, u.email as actor
       FROM audit_logs a
       LEFT JOIN users u ON u.id = a.actor_id
       ORDER BY a.created_at DESC`,
    );
    const headers = ["created_at", "action", "actor", "details"];
    const lines = [
      headers.join(","),
      ...result.rows.map((row) =>
        headers.map((h) => csvEscape(row[h])).join(","),
      ),
    ];
    return new Response(lines.join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition":
          'attachment; filename="grabstudent-audit-logs.csv"',
      },
    });
  } catch (error) {
    return handleError(error);
  }
}
