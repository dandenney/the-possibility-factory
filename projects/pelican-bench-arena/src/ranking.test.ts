import { describe, expect, it } from "vitest";
import { isSlug, parseVoteKey, rank, voteKey } from "./ranking.ts";
import type { Vote } from "./types.ts";

describe("vote keys", () => {
  it("round-trips a vote", () => {
    const vote: Vote = { a: "gemini-4-argon", b: "beam-1.0", outcome: "tie" };
    const key = voteKey(vote, 1_700_000_000_000, "abc123");
    expect(key).toBe("v/gemini-4-argon_beam-1.0_tie_loyw3v28abc123");
    expect(parseVoteKey(key)).toEqual(vote);
  });

  it("rejects malformed keys", () => {
    expect(parseVoteKey("v/a_a_a_x")).toBeNull();
    expect(parseVoteKey("v/a_b_win_x")).toBeNull();
    expect(parseVoteKey("v/A!_b_a_x")).toBeNull();
    expect(parseVoteKey("v/a_b_a")).toBeNull();
  });

  it("only allows simple slugs", () => {
    expect(isSlug("lfm-2.5-24b")).toBe(true);
    expect(isSlug("google/gemini")).toBe(false);
    expect(isSlug("a_b")).toBe(false);
  });
});

describe("rank", () => {
  const votes = (a: string, b: string, outcome: Vote["outcome"], times: number): Vote[] =>
    Array.from({ length: times }, () => ({ a, b, outcome }));

  it("centers scores on 1000 with no votes", () => {
    const standings = rank(["x", "y", "z"], []);
    expect(standings.map((s) => s.score)).toEqual([1000, 1000, 1000]);
    expect(standings.every((s) => s.votes === 0)).toBe(true);
  });

  it("orders a clear chain and keeps unbeaten models finite", () => {
    const standings = rank(["x", "y", "z"], [...votes("x", "y", "a", 6), ...votes("y", "z", "a", 6), ...votes("z", "x", "b", 6)]);
    expect(standings.map((s) => s.model)).toEqual(["x", "y", "z"]);
    expect(standings[0]!.score).toBeGreaterThan(1000);
    expect(Number.isFinite(standings[0]!.score)).toBe(true);
    expect(standings[0]).toMatchObject({ wins: 12, losses: 0, ties: 0, votes: 12 });
  });

  it("treats outcome b as a win for the right side and ties as even", () => {
    const standings = rank(["x", "y"], [...votes("x", "y", "b", 3), ...votes("x", "y", "tie", 2)]);
    expect(standings[0]).toMatchObject({ model: "y", wins: 3, ties: 2 });
    const even = rank(["x", "y"], votes("x", "y", "tie", 10));
    expect(even[0]!.score).toBe(even[1]!.score);
  });

  it("ignores votes for unknown models", () => {
    const standings = rank(["x", "y"], [{ a: "x", b: "ghost", outcome: "a" }]);
    expect(standings.every((s) => s.votes === 0)).toBe(true);
  });
});
