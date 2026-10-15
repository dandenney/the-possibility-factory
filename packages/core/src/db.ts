import type { LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "./schema.ts";

export interface DbConfig {
  url: string;
  authToken?: string;
}

export type Db = LibSQLDatabase<typeof schema>;

const isLocalUrl = (url: string) => url === ":memory:" || url.startsWith("file:");

// The default libSQL client loads a native binary that serverless bundles can't resolve,
// so remote databases use the fetch-only web client and the native one loads only for local files.
export async function createDb({ url, authToken }: DbConfig): Promise<Db> {
  if (isLocalUrl(url)) {
    const { drizzle } = await import("drizzle-orm/libsql/node");
    const db = drizzle({ connection: { url, authToken }, schema });
    await db.$client.execute("PRAGMA foreign_keys = ON");
    return db;
  }
  const { drizzle } = await import("drizzle-orm/libsql/web");
  return drizzle({ connection: { url, authToken }, schema });
}
