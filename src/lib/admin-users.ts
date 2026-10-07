import type { Client } from "@libsql/client";
import { hash } from "bcryptjs";
import { isValidEmail, isValidPhone, normalizePhone } from "./http";
import { validDocument } from "./documents";
import { validProfilePhoto, validVehicle } from "./profile";
import { newId, nowIso } from "./db";
import type { UserRecord } from "./types";

export const ADMIN_USER_COLUMNS =
  "id,name,email,phone_number,student_number,role,status,student_id_doc,license_doc,profile_photo,car_colour,car_type,car_plate,onboarding_seen_at,session_version,created_at,updated_at";
const FIELDS = [
  "name",
  "email",
  "phone_number",
  "student_number",
  "role",
  "status",
  "student_id_doc",
  "license_doc",
  "profile_photo",
  "car_colour",
  "car_type",
  "car_plate",
  "password",
];
function fail(message: string, status = 400): never {
  throw Object.assign(new Error(message), { status });
}

export async function editAdminUser(
  db: Client,
  actorId: string,
  userId: string,
  input: unknown,
  expectedUpdatedAt?: unknown,
) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    fail("Invalid account update.");
  const changes = input as Record<string, unknown>;
  const keys = Object.keys(changes);
  if (!keys.length || keys.some((key) => !FIELDS.includes(key)))
    fail("Choose valid account fields to update.");
  if (expectedUpdatedAt !== undefined && typeof expectedUpdatedAt !== "string")
    fail("Invalid account version.");
  let passwordHash: string | undefined;
  if ("password" in changes) {
    if (
      typeof changes.password !== "string" ||
      changes.password.length < 8 ||
      Buffer.byteLength(changes.password, "utf8") > 72
    )
      fail(
        "New password must contain at least 8 characters and no more than 72 bytes.",
      );
    passwordHash = await hash(changes.password, 10);
  }
  const tx = await db.transaction("write");
  try {
    const actor = (
      await tx.execute({
        sql: "SELECT role,status FROM users WHERE id=?",
        args: [actorId],
      })
    ).rows[0];
    if (!actor || actor.role !== "admin" || actor.status !== "approved")
      fail("Administrator access is required.", 403);
    const row = (
      await tx.execute({
        sql: `SELECT ${ADMIN_USER_COLUMNS} FROM users WHERE id=?`,
        args: [userId],
      })
    ).rows[0];
    if (!row) fail("User not found.", 404);
    if (expectedUpdatedAt !== undefined && expectedUpdatedAt !== row.updated_at)
      fail(
        "This account has changed since you opened it. Close the editor, refresh and try again.",
        409,
      );
    const updates: Record<string, string | number | null> = {};
    for (const key of keys.filter((key) => key !== "password")) {
      const value = changes[key];
      if (["student_id_doc", "license_doc", "profile_photo"].includes(key)) {
        if (
          value !== null &&
          (key === "profile_photo"
            ? !validProfilePhoto(value)
            : !validDocument(value))
        )
          fail(
            key === "profile_photo"
              ? "Choose a valid PNG, JPEG or WebP profile photo (max 300KB after processing)."
              : "Choose valid PNG, JPEG, WebP or PDF documents (max 1.5MB each).",
          );
        updates[key] = value as string | null;
      } else {
        if (typeof value !== "string") fail("Account details must be text.");
        updates[key] =
          key === "phone_number"
            ? normalizePhone(value)
            : key === "email"
              ? value.trim().toLowerCase()
              : key === "car_plate"
                ? value.trim().toUpperCase()
                : value.trim();
      }
    }
    const merged = { ...row, ...updates };
    if (!String(merged.name).length || String(merged.name).length > 100)
      fail("Name must contain 1 to 100 characters.");
    if (
      !isValidEmail(String(merged.email)) ||
      String(merged.email).length > 254
    )
      fail("Enter a valid email address.");
    if (
      !String(merged.student_number).length ||
      String(merged.student_number).length > 40
    )
      fail("Student / account number must contain 1 to 40 characters.");
    if (!["passenger", "driver", "admin"].includes(String(merged.role)))
      fail("Choose passenger, driver or admin.");
    if (!["pending", "approved", "rejected"].includes(String(merged.status)))
      fail("Choose a valid account status.");
    if (merged.phone_number && !isValidPhone(String(merged.phone_number)))
      fail("Enter a valid phone number with 8 to 15 digits.");
    if (merged.role !== "admin" && !merged.phone_number)
      fail("Phone number is required for passengers and drivers.");
    if (
      String(merged.car_colour).length > 30 ||
      String(merged.car_type).length > 60 ||
      (merged.car_plate &&
        !/^[A-Z0-9][A-Z0-9 -]{1,14}$/.test(String(merged.car_plate)))
    )
      fail("Enter valid car details and a plate number of 2 to 15 characters.");
    if (
      merged.role !== "admin" &&
      merged.status === "approved" &&
      !merged.student_id_doc
    )
      fail("Approved passengers and drivers need a Student ID document.");
    if (
      merged.role === "driver" &&
      merged.status === "approved" &&
      (!merged.license_doc ||
        !merged.profile_photo ||
        !validVehicle({
          car_colour: String(merged.car_colour),
          car_type: String(merged.car_type),
          car_plate: String(merged.car_plate),
        }))
    )
      fail(
        "Approved drivers need a license, profile photo and complete car details.",
      );
    if (
      row.role === "admin" &&
      row.status === "approved" &&
      (merged.role !== "admin" || merged.status !== "approved")
    ) {
      const others = (
        await tx.execute({
          sql: "SELECT COUNT(*) AS count FROM users WHERE role='admin' AND status='approved' AND id!=?",
          args: [userId],
        })
      ).rows[0];
      if (Number(others.count) === 0)
        fail("Keep at least one approved administrator account.", 409);
    }
    const duplicate = await tx.execute({
      sql: "SELECT id FROM users WHERE lower(email)=? AND id!=?",
      args: [String(merged.email), userId],
    });
    if (duplicate.rows.length)
      fail("That email address is already registered.", 409);
    const changed = keys.filter(
      (key) => key === "password" || updates[key] !== row[key],
    );
    if (!changed.length) {
      await tx.commit();
      return row as unknown as UserRecord;
    }
    const revokeSessions = changed.some((key) =>
      ["email", "password", "role", "status"].includes(key),
    );
    if (passwordHash) updates.password_hash = passwordHash;
    if (revokeSessions)
      updates.session_version = Number(row.session_version) + 1;
    updates.updated_at = nowIso();
    const columns = Object.keys(updates);
    await tx.execute({
      sql: `UPDATE users SET ${columns.map((key) => `${key}=?`).join(",")} WHERE id=?`,
      args: [...columns.map((key) => updates[key]), userId],
    });
    await tx.execute({
      sql: "INSERT INTO audit_logs (id,actor_id,action,details,created_at) VALUES (?,?,?,?,?)",
      args: [
        newId(),
        actorId,
        "EDIT_USER",
        `Updated user ${userId}: ${changed.join(", ")}`,
        nowIso(),
      ],
    });
    const updated = (
      await tx.execute({
        sql: `SELECT ${ADMIN_USER_COLUMNS} FROM users WHERE id=?`,
        args: [userId],
      })
    ).rows[0];
    await tx.commit();
    return updated as unknown as UserRecord;
  } catch (error) {
    if (!tx.closed) await tx.rollback();
    throw error;
  } finally {
    tx.close();
  }
}
