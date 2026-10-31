import { describe, expect, it } from "vitest";
import type { Play } from "./espn.ts";
import { flightFor, sampleFlight } from "./replay.ts";

const play = (over: Partial<Play>): Play => ({
  id: "1", period: 1, clock: "15:00", type: "Rush", text: "", kind: "rush", offense: "home",
  startX: 25, endX: 30, lane: 26, yards: 5, homeScore: 0, awayScore: 0, scoring: false, drive: 0, ...over,
});

describe("flights", () => {
  it("starts at the line of scrimmage and ends at the spot", () => {
    const segs = flightFor(play({}), 26);
    expect(sampleFlight(segs, 0)[0]).toBeCloseTo(25);
    expect(sampleFlight(segs, 1)[0]).toBeCloseTo(30);
  });

  it("lands a kickoff where the text says, then runs the return", () => {
    const kick = play({ kind: "kick", type: "Kickoff", offense: "away", startX: 65, endX: 27, text: "kickoff 58 yards to the IOWA07, return 20 yards" });
    const segs = flightFor(kick, 26);
    expect(segs).toHaveLength(2);
    expect(segs[0]!.to[0]).toBe(7);
    expect(sampleFlight(segs, 1)[0]).toBeCloseTo(27);
  });

  it("throws passes in an arc above the ground", () => {
    const pass = play({ kind: "pass", type: "Pass Reception", startX: 30, endX: 55 });
    const segs = flightFor(pass, 26);
    const heights = Array.from({ length: 21 }, (_, i) => sampleFlight(segs, i / 20)[1]);
    expect(Math.max(...heights)).toBeGreaterThan(4);
  });
});
