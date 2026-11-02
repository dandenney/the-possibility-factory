import { describe, expect, it } from "vitest";
import {
  computeGuilt,
  decodeShare,
  encodeShare,
  formatCount,
  formatGb,
  guessDeviceGb,
  guiltScore,
  KV_BYTES_PER_TOKEN,
  normalize,
  tierFor,
  TIERS,
} from "./guilt.ts";

describe("computeGuilt", () => {
  it("turns tabs into hoarded GB, tokens and replies", () => {
    const r = computeGuilt({ tabs: 32, weight: "typical", deviceGb: 16 });
    expect(r.mbPerTab).toBe(180);
    expect(r.hoardedGb).toBeCloseTo(5.625);
    expect(r.shareOfDevice).toBeCloseTo(5.625 / 16);
    expect(KV_BYTES_PER_TOKEN).toBe(327_680);
    expect(r.kvTokens).toBe(Math.floor((5.625 * 1024 ** 3) / 327_680));
    expect(r.replies).toBe(Math.floor(r.kvTokens / 650));
    expect(r.dramDies).toBeCloseTo(2.8125);
  });

  it("picks a quip from the tier deterministically", () => {
    const a = computeGuilt({ tabs: 40, weight: "heavy", deviceGb: 8 });
    const b = computeGuilt({ tabs: 40, weight: "heavy", deviceGb: 8 });
    expect(a.quip).toBe(b.quip);
    expect(a.tier.quips).toContain(a.quip);
  });

  it("gets guiltier with more tabs, heavier tabs and less RAM", () => {
    const base = computeGuilt({ tabs: 20, weight: "typical", deviceGb: 16 }).score;
    expect(computeGuilt({ tabs: 60, weight: "typical", deviceGb: 16 }).score).toBeGreaterThan(base);
    expect(computeGuilt({ tabs: 20, weight: "heavy", deviceGb: 16 }).score).toBeGreaterThan(base);
    expect(computeGuilt({ tabs: 20, weight: "typical", deviceGb: 4 }).score).toBeGreaterThan(base);
  });
});

describe("guiltScore and tiers", () => {
  it("stays within 0-100", () => {
    expect(guiltScore(1, 0)).toBeGreaterThanOrEqual(0);
    expect(guiltScore(500, 20)).toBe(100);
  });

  it("maps a lone tab to Data Center Ally and a tab hoard to Enemy of Scaling", () => {
    expect(computeGuilt({ tabs: 1, weight: "lean", deviceGb: 32 }).tier.title).toBe("Data Center Ally");
    expect(computeGuilt({ tabs: 150, weight: "heavy", deviceGb: 8 }).tier.title).toBe("Enemy of Scaling");
  });

  it("orders tiers from guiltiest down", () => {
    expect(TIERS.map((t) => t.min)).toEqual([...TIERS.map((t) => t.min)].sort((a, b) => b - a));
    expect(tierFor(0).title).toBe("Data Center Ally");
    expect(tierFor(100).title).toBe("Enemy of Scaling");
  });
});

describe("normalize", () => {
  it("clamps tabs and falls back for unknown values", () => {
    expect(normalize({ tabs: 0, weight: "nope" as never, deviceGb: 12 })).toEqual({ tabs: 1, weight: "typical", deviceGb: 16 });
    expect(normalize({ tabs: 9999 }).tabs).toBe(500);
    expect(normalize({ tabs: 12.6 }).tabs).toBe(13);
  });
});

describe("share links", () => {
  it("round-trips", () => {
    const input = { tabs: 47, weight: "heavy" as const, deviceGb: 32 };
    expect(decodeShare(`?${encodeShare(input)}`)).toEqual(input);
  });

  it("ignores pages without a share", () => {
    expect(decodeShare("")).toBeUndefined();
  });

  it("sanitizes tampered links", () => {
    expect(decodeShare("?t=-5&w=<script>&g=3")).toEqual({ tabs: 1, weight: "typical", deviceGb: 16 });
  });
});

describe("guessDeviceGb", () => {
  it("respects Chrome's capped deviceMemory", () => {
    expect(guessDeviceGb(undefined)).toBe(16);
    expect(guessDeviceGb(8)).toBe(16);
    expect(guessDeviceGb(4)).toBe(4);
    expect(guessDeviceGb(2)).toBe(4);
    expect(guessDeviceGb(6)).toBe(8);
  });
});

describe("formatting", () => {
  it("formats sizes and counts", () => {
    expect(formatGb(0.5)).toBe("512 MB");
    expect(formatGb(5.625)).toBe("5.6 GB");
    expect(formatGb(42.4)).toBe("42 GB");
    expect(formatCount(1234)).toBe("1,234");
    expect(formatCount(18_432)).toBe("18.4K");
  });
});
