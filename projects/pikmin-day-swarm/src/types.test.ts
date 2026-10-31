import { describe, expect, it } from "vitest";
import { pikminDay } from "./countdown.ts";
import { decodePrompts, encodePrompts, inventType } from "./types.ts";

describe("inventType", () => {
  it("reads color, traits, and count from one line", () => {
    const { type, count, traits } = inventType("20 tiny pink speedy swimmers");
    expect(count).toBe(20);
    expect(type.color).toBe("#ff6fae");
    expect(type.swims).toBe(true);
    expect(type.speed).toBeGreaterThan(1);
    expect(type.size).toBeLessThan(1);
    expect(traits).toEqual(["pink", "fast", "swims", "tiny"]);
    expect(type.name).toBe("Pink Paddlers");
  });

  it("is deterministic and always makes something", () => {
    expect(inventType("glorp").type).toEqual(inventType("glorp").type);
    expect(inventType("").count).toBe(12);
    expect(inventType("a swarm of big strong ones").count).toBe(40);
    expect(inventType("big strong ones").type.strength).toBe(4);
  });

  it("round-trips prompts through the share link", () => {
    const prompts = ["spooky ghost glowers", "fast ünïcode friends"];
    expect(decodePrompts(encodePrompts(prompts))).toEqual(prompts);
    expect(decodePrompts("not base64!!")).toEqual([]);
  });
});

describe("pikminDay", () => {
  it("counts down to November 1 and celebrates on the day", () => {
    expect(pikminDay(new Date(2026, 9, 31, 20, 0)).label).toBe("Pikmin Day in 4h 00m");
    expect(pikminDay(new Date(2026, 10, 1, 9, 0)).today).toBe(true);
    expect(pikminDay(new Date(2026, 10, 2)).label).toBe("Pikmin Day in 364 days");
  });
});
