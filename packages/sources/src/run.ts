import { createDb, upsertSignals } from "@factory/core";
import { collectors, toSignal } from "./index.ts";

const url = process.env.DATABASE_URL || "file:../../local.db";
const db = await createDb({ url, authToken: process.env.DATABASE_AUTH_TOKEN || undefined });
const only = process.argv.slice(2);
const selected = only.length ? collectors.filter((c) => only.includes(c.id)) : collectors;

let failures = 0;
for (const collector of selected) {
  try {
    const items = await collector.collect();
    const inserted = await upsertSignals(db, items.map((item) => toSignal(collector, item)));
    console.log(`${collector.id}: ${items.length} found, ${inserted.length} new`);
  } catch (err) {
    failures++;
    console.error(`${collector.id}: failed: ${err instanceof Error ? err.message : err}`);
  }
}

if (failures === selected.length) process.exit(1);
