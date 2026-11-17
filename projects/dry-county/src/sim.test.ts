import { describe, expect, it } from "vitest";
import {
  RULES, advance, canMix, deserialize, formatDay, formatTime, haul, hint, isDone, light, mashTally, mix, newGame,
  pour, serialize, type State,
} from "./sim.ts";

const H = 60;

/** Plays the whole scene the obvious way and returns the final state. */
function playThrough(): State {
  const s = newGame();
  for (let guard = 0; guard < 2000 && !isDone(s); guard++) {
    if (s.still.status === "loaded") light(s);
    for (const i of [0, 1]) if (s.still.status === "cold" && s.barrels[i]?.status === "ready") pour(s, i);
    if (s.still.status === "loaded") light(s);
    for (const i of [0, 1]) mix(s, i);
    if (s.water < RULES.batch.water && s.corn > 0) haul(s);
    advance(s, 30);
  }
  return s;
}

describe("mash", () => {
  it("uses one sack of corn, one of sugar and ten gallons of water", () => {
    const s = newGame();
    expect(mix(s, 0).ok).toBe(true);
    expect([s.corn, s.sugar, s.water]).toEqual([3, 3, 10]);
    expect(s.barrels[0].status).toBe("cooking");
  });

  it("cooks, then works for a day and a half, then is ready", () => {
    const s = newGame();
    mix(s, 0);
    advance(s, RULES.cookHours * H);
    expect(s.barrels[0].status).toBe("working");
    advance(s, RULES.fermentHours * H - 1);
    expect(s.barrels[0].status).toBe("working");
    advance(s, 1);
    expect(s.barrels[0].status).toBe("ready");
    expect(mashTally(s).ready).toBe(10);
  });

  it("refuses without enough water, and the creek tops it up", () => {
    const s = newGame();
    mix(s, 0);
    mix(s, 1);
    expect(s.water).toBe(0);
    advance(s, 40 * H);
    pour(s, 0);
    const r = canMix(s, 0);
    expect(r.ok).toBe(false);
    expect(hint(s)).toMatch(/Light the fire/);
    expect(haul(s).ok).toBe(true);
    expect(haul(s).ok).toBe(false);
    advance(s, RULES.haulHours * H);
    expect(s.water).toBe(10);
    expect(mix(s, 0).ok).toBe(true);
  });
});

describe("still", () => {
  it("only takes ready mash, one batch at a time", () => {
    const s = newGame();
    mix(s, 0);
    mix(s, 1);
    expect(pour(s, 0).ok).toBe(false);
    advance(s, (RULES.cookHours + RULES.fermentHours) * H);
    expect(pour(s, 0).ok).toBe(true);
    expect(pour(s, 1).ok).toBe(false);
    expect(light(s).ok).toBe(true);
  });

  it("fills jars one by one over the run", () => {
    const s = newGame();
    mix(s, 0);
    advance(s, (RULES.cookHours + RULES.fermentHours) * H);
    pour(s, 0);
    light(s);
    advance(s, (RULES.stillHours * H) / 2);
    expect(s.jars).toBe(RULES.jarsPerRun / 2);
    advance(s, (RULES.stillHours * H) / 2);
    expect(s.jars).toBe(RULES.jarsPerRun);
    expect(s.still.status).toBe("cold");
  });
});

describe("the whole scene", () => {
  it("turns four sacks of each into 24 jars and ends", () => {
    const s = playThrough();
    expect(isDone(s)).toBe(true);
    expect(s.jars).toBe(RULES.start.corn * RULES.jarsPerRun);
    expect(s.log[0]?.text).toMatch(/run is done/);
  });

  it("settles a long jump the same as small steps", () => {
    const a = newGame();
    const b = newGame();
    for (const s of [a, b]) {
      mix(s, 0);
      mix(s, 1);
    }
    advance(a, 100 * H);
    for (let i = 0; i < 100; i++) advance(b, H);
    expect(serialize(a)).toBe(serialize(b));
  });
});

describe("clock and saves", () => {
  it("starts on a Monday morning in 1928 and rolls over midnight", () => {
    const s = newGame();
    expect(formatDay(s.clock)).toBe("Mon, Oct 1, 1928");
    expect(formatTime(s.clock)).toBe("6:00 AM");
    expect(formatTime(18 * H + 15)).toBe("12:15 AM");
    expect(formatDay(18 * H)).toBe("Tue, Oct 2, 1928");
  });

  it("round-trips a save and rejects junk", () => {
    const s = newGame();
    mix(s, 1);
    expect(deserialize(serialize(s))).toEqual(s);
    expect(deserialize("{nope")).toBeNull();
    expect(deserialize(JSON.stringify({ version: 2 }))).toBeNull();
  });
});
