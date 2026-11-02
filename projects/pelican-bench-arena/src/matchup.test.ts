import { describe, expect, it } from "vitest";
import { pickMatchup } from "./matchup.ts";
import type { Sample } from "./types.ts";

const sample = (model: string, n: number): Sample => ({
  id: `${model}-${n}`,
  model,
  file: `/svgs/${model}/${n}.svg`,
  outputTokens: 1,
  cost: 0,
  seconds: 1,
  createdAt: "",
});

const samples = ["new-a", "new-b", "old-a", "old-b"].flatMap((m) => [sample(m, 1), sample(m, 2)]);

describe("pickMatchup", () => {
  it("always pits two different models", () => {
    for (let i = 0; i < 200; i++) {
      const m = pickMatchup(samples, new Set(["new-a", "new-b"]))!;
      expect(m.left.model).not.toBe(m.right.model);
    }
  });

  it("includes a featured model most of the time", () => {
    const featured = new Set(["new-a"]);
    let hits = 0;
    for (let i = 0; i < 1000; i++) {
      const m = pickMatchup(samples, featured)!;
      if (featured.has(m.left.model) || featured.has(m.right.model)) hits++;
    }
    expect(hits).toBeGreaterThan(700);
  });

  it("avoids repeating the previous pair", () => {
    const prev = { left: sample("new-a", 1), right: sample("old-a", 1) };
    for (let i = 0; i < 100; i++) {
      const m = pickMatchup(samples, new Set(), prev)!;
      expect([m.left.model, m.right.model].sort().join()).not.toBe("new-a,old-a");
    }
  });

  it("needs at least two models", () => {
    expect(pickMatchup([sample("solo", 1), sample("solo", 2)], new Set())).toBeNull();
  });
});
