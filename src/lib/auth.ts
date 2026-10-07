import { SignJWT } from "jose/jwt/sign";
import { jwtVerify } from "jose/jwt/verify";
import { cookies } from "next/headers";
import { ensureSchema, getDb } from "./db";
import type { Role, SessionUser } from "./types";
import { SESSION_COLUMNS, sessionUser } from "./user";

const COOKIE = "gs_session";

function secret() {
  const value = process.env.AUTH_SECRET;
  if (process.env.NODE_ENV === "production" && (!value || value.length < 32))
    throw new Error("Set AUTH_SECRET to at least 32 random characters.");
  return new TextEncoder().encode(
    value ?? "grabstudent-dev-secret-change-in-production-please",
  );
}

export async function createSession(user: SessionUser) {
  const token = await new SignJWT({
    sub: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    session_version: user.session_version,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret());

  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSession() {
  const store = await cookies();
  store.delete(COOKIE);
}

export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    await ensureSchema();
    const result = await getDb().execute({
      sql: `SELECT ${SESSION_COLUMNS} FROM users WHERE id = ?`,
      args: [String(payload.sub)],
    });
    const row = result.rows[0];
    if (!row) return null;
    if (Number(payload.session_version ?? 0) !== Number(row.session_version))
      return null;
    return sessionUser(row);
  } catch {
    return null;
  }
}

export function requireRole(user: SessionUser | null, roles: Role[]) {
  if (!user) {
    const err = new Error("Unauthorized");
    (err as Error & { status: number }).status = 401;
    throw err;
  }
  if (
    !roles.includes(user.role) ||
    (user.role === "admin" && user.status !== "approved")
  ) {
    const err = new Error("Forbidden");
    (err as Error & { status: number }).status = 403;
    throw err;
  }
  return user;
}

export function requireApproved(user: SessionUser) {
  if (user.status !== "approved") {
    const err = new Error("Account pending approval");
    (err as Error & { status: number }).status = 403;
    throw err;
  }
  return user;
}
