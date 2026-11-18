import { describe, expect, it } from "vitest";
import { parseYards, shortFor, type Shot } from "./model.ts";
import { axis, byVenue, clubSpread, median, spread, venueGap } from "./stats.ts";

let n = 0;
const shot = (p: Partial<Shot>): Shot => ({
  id: `s${++n}`,
  playerId: "dan",
  clubId: "7i",
  tee: false,
  venue: "range",
  good: true,
  at: `2026-11-${String(10 + n).padStart(2, "0")}T12:00:00.000Z`,
  ...p,
});

describe("spread", () => {
  it("uses the latest five good shots only", () => {
    const shots = [140, 150, 152, 148, 155, 160, 120].map((carry, i) => shot({ carry, good: i !== 6 }));
    const s = spread(shots, "carry")!;
    expect(s.n).toBe(5);
    expect(s.shots.map((x) => x.carry)).toEqual([160, 155, 148, 152, 150]);
    expect([s.low, s.typical, s.high]).toEqual([148, 152, 160]);
  });

  it("skips shots missing the metric and returns undefined when empty", () => {
    expect(spread([shot({ total: 170 })], "carry")).toBeUndefined();
    expect(spread([shot({ total: 170 })], "total")?.typical).toBe(170);
  });

  it("medians even counts to a whole yard", () => {
    expect(median([140, 150])).toBe(145);
    expect(median([141, 150])).toBe(146);
  });

  it("splits tee from no tee per player and club", () => {
    const shots = [shot({ carry: 230, tee: true, clubId: "driver" }), shot({ carry: 200, clubId: "driver" }), shot({ carry: 999, clubId: "driver", playerId: "misty" })];
    const s = clubSpread(shots, "dan", "driver", "carry");
    expect(s.tee?.typical).toBe(230);
    expect(s.ground?.typical).toBe(200);
  });
});

describe("venues", () => {
  it("compares each venue's typical against the course", () => {
    const shots = [shot({ venue: "topgolf", carry: 160 }), shot({ venue: "course", carry: 150 }), shot({ venue: "golftec", carry: 145 })];
    const per = byVenue(shots, "carry");
    expect(venueGap(per, "topgolf")).toBe(10);
    expect(venueGap(per, "golftec")).toBe(-5);
    expect(venueGap(per, "course")).toBeUndefined();
    expect(venueGap(per, "range")).toBeUndefined();
  });
});

describe("axis", () => {
  it("spans every spread on round steps", () => {
    const a = axis([spread([shot({ carry: 92 }), shot({ carry: 243 })], "carry")]);
    expect(a.min).toBe(75);
    expect(a.max).toBe(250);
    expect(a.step).toBe(25);
  });
  it("has a default for an empty card", () => {
    expect(axis([undefined])).toEqual({ min: 0, max: 250, step: 50 });
  });
});

describe("model helpers", () => {
  it("parses whole yards in range", () => {
    expect(parseYards("152")).toBe(152);
    expect(parseYards(" 151.6 ")).toBe(152);
    expect(parseYards("")).toBeUndefined();
    expect(parseYards("0")).toBeUndefined();
    expect(parseYards("abc")).toBeUndefined();
    expect(parseYards("600")).toBeUndefined();
  });
  it("derives short codes", () => {
    expect(shortFor("7 Wood")).toBe("7W");
    expect(shortFor("52° Wedge")).toBe("52");
    expect(shortFor("4 hybrid")).toBe("4H");
    expect(shortFor("Pitching Wedge")).toBe("PW");
    expect(shortFor("Chipper")).toBe("CH");
  });
});

describe("loftOf", () => {
  it("orders clubs by name", async () => {
    const { loftOf } = await import("./model.ts");
    const names = ["Driver", "3 Wood", "5 Wood", "7 Wood", "4 Hybrid", "5 Hybrid", "5 Iron", "6 Hybrid", "6 Iron", "7 Iron", "9 Iron", "Pitching Wedge", "50° Wedge", "52°", "Sand Wedge", "58 Wedge", "Lob Wedge", "Putter"];
    const lofts = names.map((n) => loftOf(n)!);
    expect(lofts.every((x) => x !== undefined)).toBe(true);
    expect([...lofts].sort((a, b) => a - b)).toEqual(lofts);
    expect(loftOf("Chipper")).toBeUndefined();
  });
});
