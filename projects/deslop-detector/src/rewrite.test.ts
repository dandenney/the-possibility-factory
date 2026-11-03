import { describe, expect, it } from "vitest";
import { detect } from "./detect.ts";
import { cleanReply, normalizeBase, paragraphs, pickModel, splice } from "./rewrite.ts";

describe("rewrite helpers", () => {
  it("finds paragraphs and how many marks touch each", () => {
    const text = "Plain words here.\n\nFast—and vibrant.\nAlso plain.";
    const ps = paragraphs(text, detect(text).marks);
    expect(ps.map((p) => [p.text, p.marks])).toEqual([
      ["Plain words here.", 0],
      ["Fast—and vibrant.", 2],
      ["Also plain.", 0],
    ]);
  });

  it("splices rewrites back in without touching the rest", () => {
    const text = "Keep.\n\nFix—this.\nKeep too.";
    const p = paragraphs(text, detect(text).marks).find((x) => x.marks)!;
    expect(splice(text, [{ ...p, text: "Fixed." }])).toBe("Keep.\n\nFixed.\nKeep too.");
  });

  it("cleans model replies", () => {
    expect(cleanReply("<think>hmm</think>\n\n“A plain line.”")).toBe("A plain line.");
    expect(cleanReply("<think>still thinking")).toBe("");
    expect(cleanReply("One.\n\nTwo.")).toBe("One.\nTwo.");
    expect(cleanReply("\"\"\"\nPlain.\n\"\"\"")).toBe("Plain.");
  });

  it("prefers a deslop model and normalizes the address", () => {
    expect(pickModel(["llama3:8b", "hf.co/erikkannike/qwen3-4b-deslop-v4-GGUF:Q4_K_M"])).toContain("deslop");
    expect(pickModel(["llama3:8b"])).toBe("llama3:8b");
    expect(pickModel([])).toBeUndefined();
    expect(normalizeBase("localhost:11434/")).toBe("http://localhost:11434");
  });
});
