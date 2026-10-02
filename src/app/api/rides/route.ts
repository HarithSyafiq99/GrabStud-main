import { NextResponse } from "next/server";
import { ensureSchema, getDb } from "@/lib/db";
import { getSession, requireApproved, requireRole } from "@/lib/auth";
import { handleError, jsonError } from "@/lib/http";
export async function GET() {
  try {
    await ensureSchema();
    const user = requireApproved(
      requireRole(await getSession(), ["driver", "admin"]),
    );
    const result = await getDb().execute({
      sql:
        "SELECT * FROM rides" +
        (user.role === "driver" ? " WHERE driver_id=?" : ""),
      args: user.role === "driver" ? [user.id] : [],
    });
    return NextResponse.json({ rides: result.rows });
  } catch (error) {
    return handleError(error);
  }
}
export async function POST() {
  try {
    requireApproved(
      requireRole(await getSession(), ["driver", "passenger", "admin"]),
    );
    return jsonError(
      "Passengers create journey requests. Drivers choose requests from the driver hub.",
      405,
    );
  } catch (error) {
    return handleError(error);
  }
}
