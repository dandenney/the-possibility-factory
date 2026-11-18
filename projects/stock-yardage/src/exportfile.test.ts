import { describe, expect, it } from "vitest";
import { initialState, type State } from "./model.ts";
import { buildExport, parseExport } from "./exportfile.ts";
import { load, merge, save, SAVE_KEY } from "./store.ts";

function withShots(): State {
  const s = initialState();
  s.players[1]!.clubs.push({ id: "7w", label: "7 Wood", short: "7W" });
  s.shots.push(
    { id: "a", playerId: "dan", clubId: "7i", tee: false, venue: "topgolf", carry: 150, good: true, at: "2026-11-01T10:00:00Z" },
    { id: "b", playerId: "dan", clubId: "7i", tee: true, venue: "course", carry: 145, total: 152, good: true, at: "2026-11-02T10:00:00Z" },
    { id: "c", playerId: "misty", clubId: "7w", tee: false, venue: "golftec", carry: 130, good: false, at: "2026-11-03T10:00:00Z" },
  );
  return s;
}

describe("export", () => {
  it("summarises the card and keeps raw shots", () => {
    const e = buildExport(withShots(), new Date("2026-11-18T00:00:00Z"));
    expect(e.format).toBe("stock-yardage");
    expect(e.goodShots).toBe(5);
    const dan7 = e.players[0]!.card.find((c) => c.id === "7i")!;
    expect(dan7.site).toBe("7i");
    expect(dan7.carry.ground).toEqual({ low: 150, typical: 150, high: 150, n: 1 });
    expect(dan7.total.tee?.typical).toBe(152);
    expect(dan7.venues.course?.typical).toBe(145);
    const misty7w = e.players[1]!.card.find((c) => c.id === "7w")!;
    expect(misty7w.site).toBeUndefined();
    expect(misty7w.carry.ground).toBeUndefined();
    expect(e.shots).toHaveLength(3);
  });

  it("round-trips through parse and merges without duplicates", () => {
    const text = JSON.stringify(buildExport(withShots()));
    const incoming = parseExport(text);
    const local = initialState();
    const once = merge(local, incoming);
    expect(once.added).toBe(3);
    expect(once.state.players[1]!.clubs.some((c) => c.id === "7w")).toBe(true);
    const twice = merge(once.state, incoming);
    expect(twice.added).toBe(0);
    expect(twice.state.shots).toHaveLength(3);
  });

  it("rejects files that aren't exports", () => {
    expect(() => parseExport("nope")).toThrow(/JSON/);
    expect(() => parseExport("{}")).toThrow(/Stock Yardage/);
    expect(() => parseExport(JSON.stringify({ format: "stock-yardage", version: 99 }))).toThrow(/newer/);
  });

  it("drops malformed shots", () => {
    const e = buildExport(withShots());
    (e.shots as unknown[]).push({ id: "x", venue: "moon" });
    expect(parseExport(JSON.stringify(e)).shots).toHaveLength(3);
  });
});

describe("store", () => {
  it("saves and loads, falling back on garbage", () => {
    const mem = new Map<string, string>();
    const storage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
    save(storage, withShots());
    expect(load(storage).shots).toHaveLength(3);
    mem.set(SAVE_KEY, "{bad");
    expect(load(storage).shots).toHaveLength(0);
  });
});
