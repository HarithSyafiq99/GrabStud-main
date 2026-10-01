import { mkdirSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";

export function loadEnvLocal() {
  try {
    const text = readFileSync(join(process.cwd(), ".env.local"), "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // optional
  }
}

export function resolveSqliteUrl() {
  const url = process.env.TURSO_DATABASE_URL ?? "file:./data/grabstudent.db";
  if (url.startsWith("file:")) {
    const raw = url.slice("file:".length);
    const filePath = isAbsolute(raw) ? raw : join(process.cwd(), raw);
    mkdirSync(dirname(filePath), { recursive: true });
    return `file:${filePath.replace(/\\/g, "/")}`;
  }
  return url;
}
