import { NextResponse } from "next/server";
import { ensureSchema, getDb } from "@/lib/db";
import {
  createSession,
  getSession,
  requireApproved,
  requireRole,
} from "@/lib/auth";
import { handleError, jsonError } from "@/lib/http";
import {
  ADMIN_USER_COLUMNS,
  editAdminUser,
  removeAdminUser,
  reviewAdminUser,
} from "@/lib/admin-users";
import { sessionUser } from "@/lib/user";

export async function GET(request: Request) {
  try {
    await ensureSchema();
    requireApproved(requireRole(await getSession(), ["admin"]));
    const { searchParams } = new URL(request.url);
    const tab = searchParams.get("tab") ?? "pending";
    const db = getDb();

    let sql = `SELECT ${ADMIN_USER_COLUMNS} FROM users WHERE deleted_at IS NULL AND ${tab === "all" ? "1=1" : "role != 'admin'"}`;
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
    return NextResponse.json(
      { users: result.rows },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return handleError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    await ensureSchema();
    const admin = requireApproved(requireRole(await getSession(), ["admin"]));
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body))
      return jsonError("Invalid account update.");
    const userId = String(body.userId ?? "");
    const action = String(body.action ?? "");
    if (action === "edit") {
      if (!userId) return jsonError("Choose a user to edit.");
      const user = await editAdminUser(
        getDb(),
        admin.id,
        userId,
        body.changes,
        body.expectedUpdatedAt,
      );
      let redirect: string | undefined;
      if (userId === admin.id) {
        await createSession(sessionUser(user));
        redirect =
          user.status !== "approved"
            ? "/pending"
            : user.role === "driver"
              ? "/driver"
              : user.role === "passenger"
                ? "/passenger"
                : "/admin";
      }
      return NextResponse.json(
        { ok: true, user, redirect },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    if (!userId || (action !== "approve" && action !== "reject")) {
      return jsonError("userId and action are required.");
    }

    const decision = await reviewAdminUser(
      getDb(),
      admin.id,
      userId,
      action,
      body.rejection_reason,
      body.expectedUpdatedAt,
    );
    return NextResponse.json({ ok: true, ...decision });
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    await ensureSchema();
    const admin = requireApproved(requireRole(await getSession(), ["admin"]));
    const body = await request.json();
    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      typeof body.userId !== "string" ||
      !body.userId ||
      body.confirm !== true
    )
      return jsonError("Choose an account and confirm its removal.");
    const removed = await removeAdminUser(
      getDb(),
      admin.id,
      body.userId,
      body.expectedUpdatedAt,
    );
    return NextResponse.json(
      { ok: true, ...removed },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return handleError(error);
  }
}
