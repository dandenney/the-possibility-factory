import { describe, expect, it } from "vitest";
import { evaluateBet, parseBet } from "./bets.ts";

const score = (homeScore: number, awayScore: number, state: "pre" | "in" | "post" = "in") => ({
  homeAbbr: "NEB",
  awayAbbr: "WASH",
  homeScore,
  awayScore,
  state,
});

describe("bets", () => {
  it("parses moneylines and spreads", () => {
    expect(parseBet("iowa ml")).toEqual({ team: "IOWA", kind: "ml", label: "IOWA ML" });
    expect(parseBet("WASH +7.5")).toEqual({ team: "WASH", kind: "spread", line: 7.5, label: "WASH +7.5" });
    expect(parseBet("nonsense")).toBeUndefined();
  });

  it("tracks a spread through the game", () => {
    const bet = parseBet("WASH +7.5")!;
    expect(evaluateBet(bet, score(0, 0, "pre"))?.status).toBe("pending");
    expect(evaluateBet(bet, score(14, 7))).toEqual({ status: "winning", margin: 0.5 });
    expect(evaluateBet(bet, score(21, 7))?.status).toBe("losing");
    expect(evaluateBet(bet, score(24, 20, "post"))?.status).toBe("won");
  });

  it("settles moneylines and ignores other teams", () => {
    const bet = parseBet("NEB ML")!;
    expect(evaluateBet(bet, score(10, 13, "post"))?.status).toBe("lost");
    expect(evaluateBet(parseBet("IOWA ML")!, score(1, 0))).toBeUndefined();
  });
});
