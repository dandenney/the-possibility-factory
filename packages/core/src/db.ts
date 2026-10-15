import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema.ts";

export interface DbConfig {
  url: string;
  authToken?: string;
}

export function createDb({ url, authToken }: DbConfig) {
  const client = createClient({ url, authToken });
  if (url.startsWith("file:")) void client.execute("PRAGMA foreign_keys = ON");
  return drizzle(client, { schema });
}

export type Db = ReturnType<typeof createDb>;
