import type { Role, SessionUser, UserStatus } from "./types";

export const SESSION_COLUMNS =
  "id,name,email,phone_number,role,status,profile_photo,car_colour,car_type,car_plate,onboarding_seen_at,session_version";
export function sessionUser(row: Record<string, unknown>): SessionUser {
  return {
    id: String(row.id),
    name: String(row.name),
    email: String(row.email),
    phone_number: String(row.phone_number ?? ""),
    role: row.role as Role,
    status: row.status as UserStatus,
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
