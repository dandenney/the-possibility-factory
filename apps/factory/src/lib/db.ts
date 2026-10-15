import { createDb, type Db } from "@factory/core";
import { DATABASE_AUTH_TOKEN, DATABASE_URL } from "astro:env/server";

let db: Db | undefined;

export function getDb(): Db {
  db ??= createDb({ url: DATABASE_URL, authToken: DATABASE_AUTH_TOKEN || undefined });
  return db;
}
