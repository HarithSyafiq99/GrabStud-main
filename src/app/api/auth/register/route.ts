import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { ensureSchema, getDb, newId, nowIso, writeAudit } from "@/lib/db";
import {
  isValidEmail,
  isValidPhone,
  normalizePhone,
  jsonError,
} from "@/lib/http";
import { createSession } from "@/lib/auth";
import { validDocument } from "@/lib/documents";
import type { Role } from "@/lib/types";

export async function POST(request: Request) {
  try {
    await ensureSchema();
    const body = await request.json();
    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "")
      .trim()
      .toLowerCase();
    const phone_number = normalizePhone(body.phone_number);
    const password = String(body.password ?? "");
    const student_number = String(body.student_number ?? "").trim();
    const role = String(body.role ?? "") as Role;
    const student_id_doc = body.student_id_doc
      ? String(body.student_id_doc)
      : null;
    const license_doc = body.license_doc ? String(body.license_doc) : null;

    if (!phone_number)
      return jsonError(
        "Phone number is required for both passengers and drivers.",
      );
    if (!name || !email || !password || !student_number) {
      return jsonError("All fields are required.");
    }
    if (!isValidPhone(phone_number))
      return jsonError("Enter a valid phone number with 8 to 15 digits.");
    if (!isValidEmail(email)) return jsonError("Invalid email.");
    if (password.length < 8 || password.length > 72)
      return jsonError("Password must be 8–72 characters.");
    if (name.length > 100 || email.length > 254 || student_number.length > 40)
      return jsonError("One or more fields are too long.");
    if (role !== "passenger" && role !== "driver") {
      return jsonError("Role must be passenger or driver.");
    }
    if (!validDocument(student_id_doc))
      return jsonError(
        "Upload a valid PNG, JPEG, WebP or PDF Student ID (max 1.5MB).",
      );
    if (role === "driver" && !validDocument(license_doc)) {
      return jsonError(
        "Drivers must upload both Student ID and Driving License.",
      );
    }

    const db = getDb();
    const exists = await db.execute({
      sql: "SELECT id FROM users WHERE email = ?",
      args: [email],
    });
    if (exists.rows.length > 0) return jsonError("Email already registered.");

    const id = newId();
    const now = nowIso();
    const password_hash = await hash(password, 10);

    await db.execute({
      sql: `INSERT INTO users
            (id, name, email, phone_number, password_hash, student_number, role, status, student_id_doc, license_doc, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)`,
      args: [
        id,
        name,
        email,
        phone_number,
        password_hash,
        student_number,
        role,
        student_id_doc,
        license_doc,
        now,
        now,
      ],
    });

    await writeAudit(
      id,
      "REGISTER",
      `${role} ${email} submitted documents and awaits approval`,
    );
    await createSession({
      id,
      name,
      email,
      phone_number,
      role,
      status: "pending",
    });

    return NextResponse.json({ ok: true, redirect: "/pending" });
  } catch (error) {
    console.error(error);
    return jsonError("Registration failed.", 500);
  }
}
