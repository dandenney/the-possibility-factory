import { describe, expect, it } from "vitest";
import { detect } from "./detect.ts";
import { decodeScore, decodeText, encodeScore, encodeText } from "./share.ts";

describe("share links", () => {
  it("round-trips a score and its breakdown", () => {
    const r = detect("Sure! It's fast—cheap, simple, and vibrant.");
    const back = decodeScore(`?${encodeScore(r)}`)!;
    expect(back.score).toBe(r.score);
    expect(back.words).toBe(r.words);
    expect(back.counts).toEqual(r.counts.map((c) => [c.rule.id, c.count]));
  });

  it("ignores junk", () => {
    expect(decodeScore("?s=abc&w=10")).toBeUndefined();
    expect(decodeScore("?s=10")).toBeUndefined();
    expect(decodeScore("?s=10&w=50&c=nope.3_em-dash.x_buzzword.2")!.counts).toEqual([["buzzword", 2]]);
  });

  it("round-trips text through the compressed fragment", async () => {
    const text = "Unicode — “quotes”, emoji 🚀 and\nnew lines.";
    const encoded = await encodeText(text);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(await decodeText(encoded)).toBe(text);
    expect(await decodeText("not-valid!!")).toBeUndefined();
  });
});
