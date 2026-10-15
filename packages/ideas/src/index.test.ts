import { describe, expect, it } from "vitest";
import { buildPrompt, parseProposals } from "./index.ts";

describe("parseProposals", () => {
  it("keeps only known signal ids and drops ungrounded ideas", () => {
    const input = {
      ideas: [
        { title: "A", pitch: "p", why_now: "w", signal_ids: [1, 99, 1] },
        { title: "B", pitch: "p", why_now: "w", signal_ids: [99] },
        { title: "", pitch: "p", why_now: "w", signal_ids: [1] },
      ],
    };
    expect(parseProposals(input, new Set([1, 2]))).toEqual([{ title: "A", pitch: "p", whyNow: "w", signalIds: [1] }]);
  });

  it("handles malformed input", () => {
    expect(parseProposals(undefined, new Set([1]))).toEqual([]);
    expect(parseProposals({ ideas: "nope" }, new Set([1]))).toEqual([]);
  });
});

describe("buildPrompt", () => {
  it("includes signal ids, interests, and existing ideas", () => {
    const prompt = buildPrompt({
      signals: [{ id: 7, kind: "culture", title: "GTA VI trailer", note: "Nov 19", source: "bluesky-trends" }],
      interests: "Golf, Astro",
      recentIdeas: [{ title: "Existing idea" }],
      count: 3,
    });
    expect(prompt).toContain("[7] (culture, bluesky-trends) GTA VI trailer — Nov 19");
    expect(prompt).toContain("Golf, Astro");
    expect(prompt).toContain("- Existing idea");
    expect(prompt).toContain("up to 3 ideas");
  });
});
