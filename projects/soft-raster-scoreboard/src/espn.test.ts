import { describe, expect, it } from "vitest";
import { FIELD_WIDTH, fieldX, laneFor, parseSummary } from "./espn.ts";
import fixture from "./fixtures/iowa-wisconsin.json" with { type: "json" };

describe("fieldX", () => {
  it("measures every spot from the home goal line", () => {
    expect(fieldX({ team: { id: "1" }, yardsToEndzone: 73 }, "1")).toBe(27);
    expect(fieldX({ team: { id: "2" }, yardsToEndzone: 65 }, "1")).toBe(65);
    expect(fieldX({ yardLine: 40 }, "1")).toBe(40);
    expect(fieldX(undefined, "1")).toBeUndefined();
  });
});

describe("laneFor", () => {
  it("reads direction from the play text", () => {
    expect(laneFor("rush left for 3 yards", "a")).toBeLessThan(FIELD_WIDTH / 2 - 8);
    expect(laneFor("pass short right to X", "a")).toBeGreaterThan(FIELD_WIDTH / 2 + 8);
    expect(Math.abs(laneFor("rush middle", "a") - FIELD_WIDTH / 2)).toBeLessThan(4);
  });
});

describe("parseSummary", () => {
  const game = parseSummary(fixture);

  it("reads teams and status", () => {
    expect(game.home.abbr).toBe("IOWA");
    expect(game.away.abbr).toBe("WIS");
    expect(game.state).toBe("in");
  });

  it("flattens drives into plays on one coordinate system", () => {
    expect(game.plays.length).toBe(28);
    const kickoff = game.plays[0]!;
    expect(kickoff.kind).toBe("kick");
    expect(kickoff.startX).toBe(65); // Wisconsin kicks from its own 35
    expect(kickoff.endX).toBe(27); // Iowa returns to its 27
    for (const p of game.plays) {
      expect(p.startX).toBeGreaterThanOrEqual(0);
      expect(p.endX).toBeLessThanOrEqual(100);
      expect(p.lane).toBeGreaterThan(0);
      expect(p.lane).toBeLessThan(FIELD_WIDTH);
    }
    expect(game.plays.every((p) => p.homeWinPct !== undefined)).toBe(true);
  });

  it("puts touchdowns in the end zone and keeps scores monotonic", () => {
    let last = 0;
    for (const p of game.plays) {
      expect(p.homeScore + p.awayScore).toBeGreaterThanOrEqual(last);
      last = p.homeScore + p.awayScore;
      if (p.scoring && /touchdown/i.test(p.type)) expect([0, 100]).toContain(p.endX);
    }
  });
});
