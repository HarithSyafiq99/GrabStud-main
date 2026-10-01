import { NextResponse } from "next/server";
import { clearSession, getSession } from "@/lib/auth";
import { writeAudit } from "@/lib/db";

export async function POST() {
  const user = await getSession();
  if (user) await writeAudit(user.id, "LOGOUT", `${user.email} signed out`);
  await clearSession();
  return NextResponse.json({ ok: true });
}
