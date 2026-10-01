import { loadEnvLocal } from "./env";
import { ensureSchema } from "../src/lib/db";

loadEnvLocal();

async function main() {
  await ensureSchema();
  console.log("Database schema ready.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
