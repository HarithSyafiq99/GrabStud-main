import { createClient, type Client } from "@libsql/client";
import { mkdirSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { initializeSchema } from "./migrations";

let client: Client | null = null;
let initialization: Promise<void> | null = null;

function resolveUrl() {
  const url = process.env.TURSO_DATABASE_URL ?? "file:./data/grabstudent.db";
  if (url.startsWith("file:")) {
    if (process.env.VERCEL)
      throw new Error(
        "Configure a remote TURSO_DATABASE_URL for Vercel; local SQLite is not persistent there.",
      );
    const raw = url.slice("file:".length);
    const filePath = isAbsolute(raw) ? raw : join(process.cwd(), raw);
    mkdirSync(dirname(filePath), { recursive: true });
    return `file:${filePath.replace(/\\/g, "/")}`;
  }
  return url;
}

export function getDb(): Client {
  if (!client) {
    const url = resolveUrl();
    const authToken = process.env.TURSO_AUTH_TOKEN;
    client = createClient({
      url,
      authToken: authToken ? authToken : undefined,
    });
  }
  return client;
}

export async function ensureSchema() {
  if (!initialization) {
    initialization = initializeSchema(getDb()).catch((error) => {
      initialization = null;
      throw error;
    });
  }
  await initialization;
}

export function newId() {
  return crypto.randomUUID();
}

export function nowIso() {
  return new Date().toISOString();
}

export async function writeAudit(
  actorId: string | null,
  action: string,
  details: string,
) {
  const db = getDb();
  await db.execute({
    sql: `INSERT INTO audit_logs (id, actor_id, action, details, created_at)
          VALUES (?, ?, ?, ?, ?)`,
    args: [newId(), actorId, action, details, nowIso()],
  });
}
