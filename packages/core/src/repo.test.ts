import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/libsql/migrator";
import { beforeEach, describe, expect, it } from "vitest";
import { createDb, type Db } from "./db.ts";
import {
  countSignalsByStatus,
  createIdea,
  createSignal,
  deleteIdea,
  getIdea,
  getSetting,
  listIdeas,
  listFreshSignals,
  listSignals,
  setSetting,
  setSignalStatus,
  upsertSignals,
} from "./repo.ts";

const migrationsFolder = fileURLToPath(new URL("../migrations", import.meta.url));

let db: Db;

beforeEach(async () => {
  db = await createDb({ url: ":memory:" });
  await migrate(db, { migrationsFolder });
});

describe("signals", () => {
  it("creates and filters signals", async () => {
    await createSignal(db, { title: "Claude release", kind: "model_release" });
    await createSignal(db, { title: "Bun 2", kind: "tooling_release" });
    expect(await listSignals(db)).toHaveLength(2);
    expect((await listSignals(db, { kind: "tooling_release" })).map((s) => s.title)).toEqual(["Bun 2"]);
  });

  it("dedupes automated signals by source + externalId", async () => {
    const batch = [{ title: "A", source: "rss:test", externalId: "a" }];
    expect(await upsertSignals(db, batch)).toHaveLength(1);
    expect(await upsertSignals(db, [...batch, { title: "B", source: "rss:test", externalId: "b" }])).toHaveLength(1);
    expect(await listSignals(db)).toHaveLength(2);
  });

  it("counts by status", async () => {
    const s = await createSignal(db, { title: "x" });
    await createSignal(db, { title: "y" });
    await setSignalStatus(db, s.id, "dismissed");
    expect(await countSignalsByStatus(db)).toEqual({ new: 1, dismissed: 1 });
  });
});

describe("ideas", () => {
  it("links signals on create and marks them used", async () => {
    const s = await createSignal(db, { title: "find" });
    const idea = await createIdea(db, { title: "Build it" }, [s.id]);
    const full = await getIdea(db, idea.id);
    expect(full?.signals.map((x) => x.id)).toEqual([s.id]);
    expect((await listSignals(db))[0]?.status).toBe("used");
    expect((await listIdeas(db))[0]?.signalCount).toBe(1);
  });

  it("deletes an idea and its links", async () => {
    const s = await createSignal(db, { title: "find" });
    const idea = await createIdea(db, { title: "Gone" }, [s.id]);
    await deleteIdea(db, idea.id);
    expect(await getIdea(db, idea.id)).toBeUndefined();
    expect(await listSignals(db)).toHaveLength(1);
  });
});

describe("fresh signals", () => {
  it("returns only new signals created since the cutoff", async () => {
    const fresh = await createSignal(db, { title: "fresh" });
    const used = await createSignal(db, { title: "used" });
    await setSignalStatus(db, used.id, "used");
    await createSignal(db, { title: "old", createdAt: new Date("2020-01-01") });
    const rows = await listFreshSignals(db, new Date("2024-01-01"));
    expect(rows.map((r) => r.id)).toEqual([fresh.id]);
  });
});

describe("settings", () => {
  it("stores and overwrites values", async () => {
    expect(await getSetting(db, "interests")).toBeUndefined();
    await setSetting(db, "interests", "a");
    await setSetting(db, "interests", "b");
    expect(await getSetting(db, "interests")).toBe("b");
  });
});
