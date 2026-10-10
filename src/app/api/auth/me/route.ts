import { NextResponse } from "next/server";
import { createSession, getSession } from "@/lib/auth";
import { getDb, nowIso, writeAudit } from "@/lib/db";
import {
  handleError,
  isValidPhone,
  normalizePhone,
  jsonError,
} from "@/lib/http";
import {
  validPassportPhoto,
  PASSPORT_PHOTO_ERROR,
  validVehicle,
} from "@/lib/profile";
import { SESSION_COLUMNS, sessionUser } from "@/lib/user";

export async function GET() {
  const user = await getSession();
  if (!user) return jsonError("Unauthorized", 401);
  await createSession(user);
  return NextResponse.json({ user });
}

export async function PATCH(request: Request) {
  try {
    const user = await getSession();
    if (!user) return jsonError("Unauthorized", 401);
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body))
      return jsonError("Invalid profile update.");
    if ("onboarding_seen" in body) {
      if (body.onboarding_seen !== true || Object.keys(body).length !== 1)
        return jsonError("Invalid welcome-guide update.");
      const updated = await getDb().execute({
        sql: "UPDATE users SET onboarding_seen_at=COALESCE(onboarding_seen_at,?),updated_at=? WHERE id=? AND deleted_at IS NULL",
        args: [nowIso(), nowIso(), user.id],
      });
      if (!updated.rowsAffected) return jsonError("Unauthorized", 401);
      return NextResponse.json({ ok: true });
    }
    const keys = [
      "name",
      "phone_number",
      "profile_photo",
      "car_colour",
      "car_type",
      "car_plate",
    ];
    if (
      !Object.keys(body).length ||
      Object.keys(body).some((key) => !keys.includes(key))
    )
      return jsonError("Invalid profile update.");
    if (
      user.role !== "driver" &&
      Object.keys(body).some((key) => key.startsWith("car_"))
    )
      return jsonError("Car details are only available for drivers.");
    const phone =
      "phone_number" in body
        ? normalizePhone(body.phone_number)
        : user.phone_number;
    if ("phone_number" in body && !isValidPhone(phone))
      return jsonError("Enter a valid phone number with 8 to 15 digits.");
    const photo =
      "profile_photo" in body ? body.profile_photo : user.profile_photo;
    if (
      photo !== null &&
      photo !== user.profile_photo &&
      !validPassportPhoto(photo)
    )
      return jsonError(PASSPORT_PHOTO_ERROR);
    const name =
      "name" in body && typeof body.name === "string"
        ? body.name.trim()
        : user.name;
    if (
      "name" in body &&
      (typeof body.name !== "string" || !name || name.length > 100)
    )
      return jsonError("Name must contain 1 to 100 characters.");
    const vehicle = {
      car_colour:
        "car_colour" in body ? String(body.car_colour).trim() : user.car_colour,
      car_type:
        "car_type" in body ? String(body.car_type).trim() : user.car_type,
      car_plate:
        "car_plate" in body
          ? String(body.car_plate).trim().toUpperCase()
          : user.car_plate,
    };
    const updatesDriverProfile =
      "profile_photo" in body ||
      Object.keys(body).some((key) => key.startsWith("car_"));
    if (
      user.role === "driver" &&
      updatesDriverProfile &&
      (!photo || !validVehicle(vehicle))
    )
      return jsonError(
        "Drivers need a profile photo, car colour, model/type and valid plate number.",
      );
    const changes = {
      name,
      phone_number: phone,
      profile_photo: photo,
      ...vehicle,
    };
    const names = Object.keys(body) as (keyof typeof changes)[];
    const updated = await getDb().execute({
      sql: `UPDATE users SET ${names.map((key) => key + "=?").join(",")},updated_at=? WHERE id=? AND deleted_at IS NULL`,
      args: [...names.map((key) => changes[key]), nowIso(), user.id],
    });
    if (!updated.rowsAffected) return jsonError("Unauthorized", 401);
    await writeAudit(
      user.id,
      Object.keys(body).length === 1 && "phone_number" in body
        ? "UPDATE_PHONE"
        : "UPDATE_PROFILE",
      "Updated contact/profile details",
    );
    const result = await getDb().execute({
      sql: `SELECT ${SESSION_COLUMNS} FROM users WHERE id=? AND deleted_at IS NULL`,
      args: [user.id],
    });
    if (!result.rows[0]) return jsonError("Unauthorized", 401);
    return NextResponse.json({
      ok: true,
      phone_number: phone,
      user: sessionUser(result.rows[0]),
    });
  } catch (error) {
    return handleError(error);
  }
}
