import { describe, expect, it } from "vitest";
import { countWords, detect, RULES, segments, splitSentences, tierFor, type RuleId } from "./detect.ts";
import { SAMPLES } from "./samples.ts";

const found = (text: string, rule: RuleId) =>
  detect(text).marks.filter((m) => m.rule === rule).map((m) => text.slice(m.start, m.end));

describe("rules", () => {
  it("catches em dashes and spaced hyphens but not hyphenated words", () => {
    expect(found("It was fast—really fast. Then – again - slower.", "em-dash")).toEqual(["—", "–", "-"]);
    expect(found("A well-known, low-key place.", "em-dash")).toEqual([]);
  });

  it("catches the not X, but Y family", () => {
    expect(found("It isn't just a change of address; it's a new start.", "not-x-but-y")).toHaveLength(1);
    expect(found("It's not about tech. It's about people.", "not-x-but-y")).toHaveLength(1);
    expect(found("The plan was not perfect, but it worked.", "not-x-but-y")).toHaveLength(1);
    expect(found("Saving is not only prudent but essential.", "not-x-but-y")).toHaveLength(1);
    expect(found("I did not go to the store today.", "not-x-but-y")).toEqual([]);
  });

  it("counts a list of three once, even inside a longer list", () => {
    expect(found("It is fast, simple, and powerful.", "list-of-three")).toHaveLength(1);
    expect(found("Bring jobs, communities, hobbies, and perspectives.", "list-of-three")).toHaveLength(1);
    expect(found("I like tea and toast.", "list-of-three")).toEqual([]);
  });

  it("matches whole buzzwords only", () => {
    expect(found("Let us delve into this vibrant tapestry.", "buzzword")).toEqual(["delve", "vibrant", "tapestry"]);
    expect(found("The delver found a realmless map.", "buzzword")).toEqual([]);
  });

  it("finds questions answered on the spot", () => {
    expect(found("We tried it. The best part? It was free.", "rhetorical-question")).toEqual(["The best part?"]);
    expect(found("Do you want to come along to the show tonight with us? Let me know.", "rhetorical-question")).toEqual([]);
    expect(found("The best part?", "rhetorical-question")).toEqual([]);
  });

  it("flags short emphatic fragments but not abbreviations", () => {
    expect(found("We rebuilt the whole pipeline over a weekend. It worked. Mostly.", "short-fragment")).toEqual(["It worked.", "Mostly."]);
    expect(found("Dr. Smith met Mr. Jones at noon for lunch.", "short-fragment")).toEqual([]);
  });

  it("finds the rest", () => {
    expect(found("Sure! Here's a short blog post about it.", "chatbot-frame")).toEqual(["Sure!", "Here's a short blog post"]);
    expect(found("Here's the thing: let's dive in.", "signpost")).toEqual(["Here's the thing", "let's dive"]);
    expect(found("It serves as a reminder and plays a crucial role.", "serves-as")).toEqual(["serves as a", "plays a crucial role"]);
    expect(found("Prices fell, making it cheaper.", "ing-tail")).toEqual([", making"]);
    expect(found("From startups to enterprises, everyone wins.", "from-x-to-y")).toEqual(["From startups to enterprises,"]);
    expect(found("Let's be honest, nobody reads the docs.", "honesty")).toEqual(["Let's be honest"]);
    expect(found("It is revolutionizing the future of work.", "grandiose")).toEqual(["revolutionizing", "the future of work"]);
    expect(found("Points. First, we plan. Second, we ship.", "listicle")).toEqual(["First,", "Second,"]);
    expect(found("## Heading\n- item\n**Bold:** text", "markdown")).toEqual(["## ", "- ", "**Bold:**"]);
    expect(found("Launch day 🚀", "emoji")).toEqual(["🚀"]);
  });

  it("gives every rule a unique id and a positive weight", () => {
    expect(new Set(RULES.map((r) => r.id)).size).toBe(RULES.length);
    for (const r of RULES) expect(r.weight).toBeGreaterThan(0);
  });
});

describe("score", () => {
  it("is weighted tics per 1000 words", () => {
    const text = "It was fast—really fast and we liked it a lot in the end today ok.";
    const r = detect(text);
    expect(r.words).toBe(countWords(text));
    expect(r.points).toBe(2);
    expect(r.score).toBeCloseTo((2 * 1000) / r.words, 1);
  });

  it("is zero for empty text and plain prose", () => {
    expect(detect("").score).toBe(0);
    expect(detect("I walked to the shop and bought bread. The baker was out of rye, so I took white.").score).toBe(0);
  });

  it("can leave rules out", () => {
    const r = detect("Fast—and cheap.", new Set<RuleId>(["buzzword"]));
    expect(r.marks).toEqual([]);
  });

  it("ranks the samples the right way round", () => {
    const score = (id: string) => detect(SAMPLES.find((s) => s.id === id)!.text).score;
    expect(score("blog")).toBeGreaterThan(80);
    expect(score("linkedin")).toBeGreaterThan(80);
    expect(score("plain")).toBeLessThan(15);
  });

  it("maps scores to tiers", () => {
    expect(tierFor(0).title).toBe("Reads human");
    expect(tierFor(121).title).toBe("Certified slop");
    expect(tierFor(400).title).toBe("Pure slop");
  });
});

describe("text helpers", () => {
  it("splits sentences with offsets per paragraph", () => {
    const text = "One two. Three?\nFour 3.5 five!";
    const s = splitSentences(text);
    expect(s.map((x) => x.text)).toEqual(["One two.", "Three?", "Four 3.5 five!"]);
    expect(s.map((x) => text.slice(x.start, x.end))).toEqual(s.map((x) => x.text));
    expect(s.map((x) => [x.para, x.index, x.of])).toEqual([[0, 0, 2], [0, 1, 2], [1, 0, 1]]);
  });

  it("cuts segments at overlapping marks", () => {
    const segs = segments("abcdef", [
      { start: 1, end: 4, rule: "buzzword" },
      { start: 2, end: 5, rule: "em-dash" },
    ]);
    expect(segs.map((s) => [s.text, s.rules])).toEqual([
      ["a", []],
      ["b", ["buzzword"]],
      ["cd", ["buzzword", "em-dash"]],
      ["e", ["em-dash"]],
      ["f", []],
    ]);
  });
});
