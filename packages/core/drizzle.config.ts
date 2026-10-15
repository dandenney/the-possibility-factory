import { existsSync } from "node:fs";
import { defineConfig } from "drizzle-kit";

const appEnv = new URL("../../apps/factory/.env", import.meta.url);
if (existsSync(appEnv)) process.loadEnvFile(appEnv);

export default defineConfig({
  dialect: "turso",
  schema: "./src/schema.ts",
  out: "./migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "file:../../local.db",
    authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
  },
});
