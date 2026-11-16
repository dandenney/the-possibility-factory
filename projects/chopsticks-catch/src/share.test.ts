import { describe, expect, it } from "vitest";
import { challengeUrl, parseChallenge, shareText } from "./share.ts";

describe("challenge links", () => {
  it("round-trip the flight and score", () => {
    const url = challengeUrl(4821, { kind: "caught", grade: "clean", speed: 1.8, offset: 0.6, score: 812, fuelLeft: 0.3 });
    expect(url).toBe("https://chopsticks-catch.netlify.app/?f=4821&s=812");
    expect(parseChallenge(new URL(url).search)).toEqual({ flight: 4821, score: 812 });
  });

  it("ignore junk", () => {
    expect(parseChallenge("?f=abc&s=99999")).toEqual({ flight: undefined, score: undefined });
    expect(parseChallenge("?f=0")).toEqual({ flight: undefined, score: undefined });
  });

  it("leave the score off a crash", () => {
    const crash = { kind: "crashed", reason: "tower", speed: 30, offset: 9 } as const;
    expect(challengeUrl(7, crash)).toBe("https://chopsticks-catch.netlify.app/?f=7");
    expect(shareText(7, crash)).toContain("flight 7");
  });
});
