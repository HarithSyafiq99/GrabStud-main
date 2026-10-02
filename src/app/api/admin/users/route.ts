import { NextResponse } from "next/server";
import { ensureSchema, getDb, nowIso, writeAudit } from "@/lib/db";
import { getSession, requireRole } from "@/lib/auth";
import { handleError, jsonError } from "@/lib/http";

export async function GET(request: Request) {
  try {
    await ensureSchema();
    requireRole(await getSession(), ["admin"]);
    const { searchParams } = new URL(request.url);
    const tab = searchParams.get("tab") ?? "pending";
    const db = getDb();

    let sql = `SELECT id, name, email, phone_number, student_number, role, status, student_id_doc, license_doc, created_at
               FROM users WHERE role != 'admin'`;
    const args: string[] = [];
    if (tab === "pending") {
      sql += " AND status = 'pending'";
    } else if (tab === "approved") {
      sql += " AND status = 'approved'";
    } else if (tab === "rejected") {
      sql += " AND status = 'rejected'";
    }
    sql += " ORDER BY created_at DESC";

    const result = await db.execute({ sql, args });
    return NextResponse.json({ users: result.rows });
  } catch (error) {
    return handleError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    await ensureSchema();
    const admin = requireRole(await getSession(), ["admin"]);
    const body = await request.json();
    const userId = String(body.userId ?? "");
    const action = String(body.action ?? "");
    if (!userId || (action !== "approve" && action !== "reject")) {
      return jsonError("userId and action are required.");
    }

    const db = getDb();
    const userRes = await db.execute({
      sql: "SELECT * FROM users WHERE id = ?",
      args: [userId],
    });
    const target = userRes.rows[0];
    if (!target) return jsonError("User not found.", 404);
    if (String(target.role) === "admin")
      return jsonError("Cannot modify admin.");

    if (action === "approve") {
      if (String(target.role) === "driver") {
        if (!target.student_id_doc || !target.license_doc) {
          return jsonError(
            "Drivers must have both Student ID and Driving License.",
          );
        }
      }
      if (!target.student_id_doc) {
        return jsonError("Student ID document is required.");
      }
    }

    const status = action === "approve" ? "approved" : "rejected";
    await db.execute({
      sql: "UPDATE users SET status = ?, updated_at = ? WHERE id = ?",
      args: [status, nowIso(), userId],
    });
    await writeAudit(
      admin.id,
      action === "approve" ? "APPROVE_USER" : "REJECT_USER",
      `${target.email} set to ${status}`,
    );
    return NextResponse.json({ ok: true, status });
  } catch (error) {
    return handleError(error);
  }
}
