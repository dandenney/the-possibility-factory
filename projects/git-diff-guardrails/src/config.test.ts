import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ConfigError, loadConfig, parseConfig, ruleProblems, STARTER_RULES } from "./config.ts";

describe("config", () => {
  it("accepts the starter rules", () => {
    expect(parseConfig({ version: 1, rules: STARTER_RULES }).rules).toHaveLength(STARTER_RULES.length);
  });

  it("reports problems per rule", () => {
    expect(ruleProblems({ id: "Bad Id", type: "line", message: "m", pattern: "(" })).toEqual([
      "`id` must be kebab-case",
      expect.stringContaining("invalid pattern"),
    ]);
    expect(ruleProblems({ id: "f", type: "file", message: "m" })).toEqual(["`paths` is required for file rules"]);
    expect(ruleProblems({ id: "c", type: "cochange", message: "m", paths: ["a"] })).toEqual([
      "`require` is required for cochange rules",
    ]);
    expect(ruleProblems({ id: "x", type: "line", message: "m", pattern: "a", flags: "g" })).toEqual([
      "`flags` may only contain i, m, s, u",
    ]);
    expect(ruleProblems({ id: "x", type: "nope", message: "m" })).toEqual(["`type` must be line, file, or cochange"]);
  });

  it("rejects duplicate ids", () => {
    const rule = { id: "a", type: "line", message: "m", pattern: "x" };
    expect(() => parseConfig({ rules: [rule, rule] })).toThrow(/duplicate id/);
  });

  it("loads from disk with helpful errors", () => {
    const dir = mkdtempSync(join(tmpdir(), "diffrails-config-"));
    expect(() => loadConfig(dir)).toThrow(/diffrails init/);
    writeFileSync(join(dir, ".diffrails.json"), "{");
    expect(() => loadConfig(dir)).toThrow(ConfigError);
    writeFileSync(join(dir, ".diffrails.json"), JSON.stringify({ version: 1, rules: [] }));
    expect(loadConfig(dir)).toEqual({ version: 1, ignore: undefined, rules: [] });
  });
});
