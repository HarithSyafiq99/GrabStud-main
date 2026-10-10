import type { Role, SessionUser, UserStatus } from "./types";
import type { Client } from "@libsql/client";

/** Recheck access after obtaining the write lock, including in-flight removal. */
export async function requireActiveAccount(
  db: Pick<Client, "execute">,
  user: SessionUser,
) {
  const row = (
    await db.execute({
      sql: "SELECT role,status,session_version FROM users WHERE id=? AND deleted_at IS NULL",
      args: [user.id],
    })
  ).rows[0];
  if (
    !row ||
    Number(row.session_version) !== user.session_version ||
    row.role !== user.role ||
    row.status !== user.status
  )
    throw Object.assign(
      new Error("Your account access has changed. Please sign in again."),
      { status: 401 },
    );
}

export const SESSION_COLUMNS =
  "id,name,email,phone_number,role,status,rejection_reason,profile_photo,car_colour,car_type,car_plate,onboarding_seen_at,session_version";
export function sessionUser(row: Record<string, unknown>): SessionUser {
  return {
    id: String(row.id),
    name: String(row.name),
    email: String(row.email),
    phone_number: String(row.phone_number ?? ""),
    role: row.role as Role,
    status: row.status as UserStatus,
    rejection_reason: row.rejection_reason
      ? String(row.rejection_reason)
      : null,
    profile_photo: row.profile_photo ? String(row.profile_photo) : null,
    car_colour: String(row.car_colour ?? ""),
    car_type: String(row.car_type ?? ""),
    car_plate: String(row.car_plate ?? ""),
    onboarding_seen_at: row.onboarding_seen_at
      ? String(row.onboarding_seen_at)
      : null,
    session_version: Number(row.session_version ?? 0),
  };
}
