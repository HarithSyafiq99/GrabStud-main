import { NextResponse } from "next/server";
import { getSession, requireRole, createSession } from "@/lib/auth";
import { ensureSchema, getDb, nowIso, writeAudit } from "@/lib/db";
import { validDocument } from "@/lib/documents";
import { handleError, jsonError } from "@/lib/http";
export async function POST(request: Request) {
  try {
    await ensureSchema();
    const user = requireRole(await getSession(), ["passenger", "driver"]);
    if (user.status !== "rejected")
      return jsonError("Only declined applications can be resubmitted.");
    const b = await request.json();
    if (
      !validDocument(b.student_id_doc) ||
      (user.role === "driver" && !validDocument(b.license_doc))
    )
      return jsonError("Upload valid documents (max 1.5MB each).");
    await getDb().execute({
      sql: "UPDATE users SET student_id_doc=?,license_doc=?,status='pending',updated_at=? WHERE id=?",
      args: [
        b.student_id_doc,
        user.role === "driver" ? b.license_doc : null,
        nowIso(),
        user.id,
      ],
    });
    await writeAudit(user.id, "RESUBMIT", "Updated documents for review");
    await createSession({ ...user, status: "pending" });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
