// The slop detector: regex rules for common AI writing habits, a weighted score per 1000 words,
// and the marks the heatmap draws. No DOM in here so it stays testable.

export type RuleId =
  | "em-dash"
  | "not-x-but-y"
  | "list-of-three"
  | "buzzword"
  | "grandiose"
  | "signpost"
  | "rhetorical-question"
  | "chatbot-frame"
  | "serves-as"
  | "ing-tail"
  | "from-x-to-y"
  | "honesty"
  | "listicle"
  | "short-fragment"
  | "markdown"
  | "emoji";

export interface Rule {
  id: RuleId;
  label: string;
  weight: number;
  tip: string;
  find: (text: string, ctx: Context) => Span[];
}

export type Span = [start: number, end: number];

export interface Mark {
  start: number;
  end: number;
  rule: RuleId;
}

export interface Sentence {
  start: number;
  end: number;
  text: string;
  words: number;
  /** Index of the paragraph it belongs to. */
  para: number;
  /** Position within the paragraph. */
  index: number;
  /** Number of sentences in the paragraph. */
  of: number;
}

interface Context {
  sentences: Sentence[];
}

const W = "[\\p{L}\\p{N}'’-]+";
const APOS = "['’]";
const WORD_RE = /[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu;

export function countWords(text: string): number {
  return text.match(WORD_RE)?.length ?? 0;
}

function all(re: RegExp, text: string, group?: number): Span[] {
  const spans: Span[] = [];
  for (const m of text.matchAll(re)) {
    if (group === undefined) spans.push([m.index, m.index + m[0].length]);
    else if (m[group] !== undefined) {
      const start = m.index + m[0].indexOf(m[group]);
      spans.push([start, start + m[group].length]);
    }
  }
  return spans;
}

function words(list: string[]): RegExp {
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${list.join("|")})(?![\\p{L}\\p{N}])`, "giu");
}

const BUZZWORDS = [
  "delve[sd]?", "delving", "tapestr(?:y|ies)", "testament", "seamless(?:ly)?", "leverag(?:e|es|ed|ing)",
  "robust", "landscape", "realm", "navigat(?:e|es|ing)", "elevat(?:e|es|ed|ing)", "unlock(?:s|ed|ing)?",
  "unleash(?:es|ed|ing)?", "embark(?:s|ed|ing)?", "intricate", "intricacies", "pivotal", "underscor(?:e|es|ed|ing)",
  "foster(?:s|ed|ing)?", "vibrant", "bustling", "meticulous(?:ly)?", "transformative", "transformation",
  "profound(?:ly)?", "holistic", "synerg(?:y|ies)", "paradigm", "cutting-edge", "ever-evolving", "fast-paced",
  "empower(?:s|ed|ing|ment)?", "harness(?:es|ed|ing)?", "crucial", "nuanced", "multifaceted", "showcas(?:e|es|ed|ing)",
  "resonat(?:e|es|ed|ing)", "captivating", "beacon", "symphony", "interplay", "myriad", "plethora", "bolster(?:s|ed|ing)?",
  "streamlin(?:e|es|ed|ing)", "invaluable", "endeavou?rs?", "garner(?:s|ed|ing)?", "thriv(?:e|es|ing)",
  "game-chang(?:er|ers|ing)", "dynamic", "innovative", "insightful", "commendable", "embrac(?:e|es|ing)",
  "journey", "unwavering", "enhanc(?:e|es|ed|ing)", "optimi[sz](?:e|es|ed|ing)", "actionable", "impactful",
];

const GRANDIOSE = [
  "revolutioni[sz](?:e|es|ed|ing)", "redefin(?:e|es|ed|ing)", "reshap(?:e|es|ed|ing)", "the future of [\\p{L}]+",
  "a new era", "paradigm shift", "changed everything", "forever changed", "unprecedented", "groundbreaking",
  "ushering in", "at the forefront", "in an era of", "more than ever",
];

const SIGNPOSTS = [
  `here${APOS}s (?:the thing|the kicker|why|what|how|the deal|the catch)`, `let${APOS}s (?:dive|break (?:it|this) down|explore|unpack|take a (?:closer )?look)`,
  "dive (?:in|into|deeper)", `it${APOS}s worth (?:noting|mentioning)`, "it is (?:important|worth) (?:to note|noting)", "importantly,",
  "ultimately,", "in conclusion", "in summary", "to sum up", "at the end of the day", "the bottom line",
  "imagine (?:a|an|your|you|if|this|walking|waking)", "think of (?:it|this|them) (?:like|as)", "is like a",
  `in today${APOS}s (?:fast-paced |digital |modern |ever-changing |busy )?world`, "when it comes to", "the key takeaway",
  "the truth is", "make no mistake", "buckle up", "picture this", "the reality is", "the result\\?",
];

const FRAMES = [
  "sure!", "certainly!", "absolutely!", "of course[,!]", "great question", "i hope this helps",
  "let me know if", "feel free to", "as an ai", "happy to help", "in this (?:article|post|guide|blog post)",
  `here${APOS}s (?:a|an) (?:short |quick |brief )?(?:blog post|post|article|draft|summary|version|breakdown|overview)`,
];

const HONESTY = [
  `let${APOS}s be (?:honest|real|clear)`, `let${APOS}s face it`, "truth be told", "to be (?:honest|frank|clear)",
  "honestly,", `i${APOS}ll be honest`, "the honest truth", "spoiler alert",
];

const SERVES_AS = [
  "serves as(?: a| an)?", "stands as(?: a| an)?", "marks a (?:turning|pivotal|new|significant|major)",
  "is a testament to", "plays an? (?:crucial|vital|key|pivotal|important|significant) role",
];

const ABBREV = /^(?:mr|mrs|ms|dr|st|vs|etc|e\.g|i\.e|jr|sr|no|fig|inc|co|ltd|u\.s|a\.m|p\.m)\.$/i;

export function splitSentences(text: string): Sentence[] {
  const out: Sentence[] = [];
  let para = 0;
  const paraRe = /[^\n]+/g;
  for (const pm of text.matchAll(paraRe)) {
    if (!pm[0].trim()) continue;
    const base = pm.index;
    const p = pm[0];
    const local: Omit<Sentence, "of">[] = [];
    const endRe = /[.!?…]+["”’)\]]*(?=\s|$)/g;
    let cursor = 0;
    const push = (end: number) => {
      const raw = p.slice(cursor, end);
      const lead = raw.length - raw.trimStart().length;
      const s = raw.trim();
      if (s) {
        local.push({ start: base + cursor + lead, end: base + cursor + lead + s.length, text: s, words: countWords(s), para, index: local.length });
      }
      cursor = end;
    };
    for (const m of p.matchAll(endRe)) {
      const end = m.index + m[0].length;
      const candidate = p.slice(cursor, end).trim();
      if (ABBREV.test(candidate.split(/\s+/).pop() ?? "")) continue;
      push(end);
    }
    if (cursor < p.length) push(p.length);
    for (const s of local) out.push({ ...s, of: local.length });
    para++;
  }
  return out;
}

export const RULES: Rule[] = [
  {
    id: "em-dash",
    label: "Em dash",
    weight: 2,
    tip: "The em dash is the best-known tell. A comma, colon or full stop usually does the same job.",
    find: (t) => all(/—|(?<=\s)[–-]{1,2}(?=\s)|(?<=\p{L})--(?=\p{L})/gu, t),
  },
  {
    id: "not-x-but-y",
    label: "Not X, but Y",
    weight: 3,
    tip: "\"It's not X, it's Y\" sets up a claim nobody made so it can knock it down. Just say Y.",
    find: (t) => [
      ...all(new RegExp(`(?:(?<![\\p{L}])not|n${APOS}t)\\s+(?:just|only|merely|simply|about|because)\\b[^.!?\\n]{0,60}?(?:[,;:—–.]\\s*|\\s+)(?:but|it${APOS}s|it is|they${APOS}re|that${APOS}s|this is|it was|rather|instead|he${APOS}s|she${APOS}s|we${APOS}re|you${APOS}re)(?![\\p{L}])`, "giu"), t),
      ...all(new RegExp(`(?:(?<![\\p{L}])not|n${APOS}t)\\s+[^.!?\\n,;—–]{1,40}?[,;—–]\\s*but(?![\\p{L}])`, "giu"), t),
      ...all(new RegExp(`(?<![\\p{L}])(?:it|this|that)(?:${APOS}s| is| was)\\s+not\\s+[^.!?\\n]{1,50}?[.;—–]\\s*(?:it${APOS}s|it is|this is|that${APOS}s|it was)(?![\\p{L}])`, "giu"), t),
      ...all(/\bless about\b[^.!?\n]{1,50}?\bmore about\b/giu, t),
    ],
  },
  {
    id: "list-of-three",
    label: "List of three",
    weight: 1,
    tip: "Triplets (\"fast, simple, and powerful\") give prose a sales rhythm. Keep the one item that matters.",
    find: (t) => all(new RegExp(`${W}(?:\\s+${W}){0,4},\\s+${W}(?:\\s+${W}){0,4},?\\s+(?:and|or)\\s+${W}(?:\\s+${W}){0,3}`, "gu"), t),
  },
  {
    id: "buzzword",
    label: "Buzzword",
    weight: 2,
    tip: "Words like delve, tapestry, seamless and vibrant show up far more in model output than in people's writing.",
    find: (t) => all(words(BUZZWORDS), t),
  },
  {
    id: "grandiose",
    label: "Grandiose",
    weight: 2,
    tip: "Revolutionizing, redefining, a new era. Inflated stakes for ordinary news.",
    find: (t) => all(words(GRANDIOSE), t),
  },
  {
    id: "signpost",
    label: "Signpost",
    weight: 2,
    tip: "\"Here's the thing\", \"let's dive in\", \"ultimately\": announcing a point instead of making it.",
    find: (t) => all(words(SIGNPOSTS), t),
  },
  {
    id: "rhetorical-question",
    label: "Asked and answered",
    weight: 2,
    tip: "\"The best part? It's free.\" A question the writer answers right away, for drama.",
    find: (_t, { sentences }) =>
      sentences
        .filter((s, i) => {
          const next = sentences[i + 1];
          return s.text.endsWith("?") && s.words <= 6 && next !== undefined && next.para === s.para && !next.text.endsWith("?");
        })
        .map((s) => [s.start, s.end] as Span),
  },
  {
    id: "chatbot-frame",
    label: "Chatbot frame",
    weight: 2,
    tip: "\"Sure!\", \"Of course,\", \"I hope this helps\": the assistant talking, not the writer.",
    find: (t) => all(words(FRAMES), t),
  },
  {
    id: "serves-as",
    label: "Serves as",
    weight: 2,
    tip: "\"Serves as a\", \"stands as a\", \"plays a crucial role\": a long way to write \"is\".",
    find: (t) => all(words(SERVES_AS), t),
  },
  {
    id: "ing-tail",
    label: "-ing tail",
    weight: 1,
    tip: "A sentence that ends \", making it…\" or \", ensuring…\" tacks on a vague consequence.",
    find: (t) =>
      all(/,\s(?:making|helping|ensuring|allowing|enabling|creating|fostering|providing|highlighting|underscoring|showcasing|reflecting|paving|offering|leaving|turning|giving)\b/giu, t),
  },
  {
    id: "from-x-to-y",
    label: "From X to Y",
    weight: 2,
    tip: "\"From startups to enterprises, …\": a sweep that implies everything is covered.",
    find: (_t, { sentences }) =>
      sentences.flatMap((s) => {
        const m = /^From\s[^,.;]{2,50}?\sto\s[^,.;]{2,50},/u.exec(s.text);
        return m ? [[s.start, s.start + m[0].length] as Span] : [];
      }),
  },
  {
    id: "honesty",
    label: "Performative honesty",
    weight: 2,
    tip: "\"Let's be honest\" promises candor that the next sentence rarely delivers.",
    find: (t) => all(words(HONESTY), t),
  },
  {
    id: "listicle",
    label: "Listicle",
    weight: 1,
    tip: "First, second, third, lastly: an outline wearing a paragraph.",
    find: (_t, { sentences }) =>
      sentences.flatMap((s) => {
        const m = /^(?:First(?:ly)?|Second(?:ly)?|Third(?:ly)?|Lastly|Last but not least)\b,?/u.exec(s.text);
        return m ? [[s.start, s.start + m[0].length] as Span] : [];
      }),
  },
  {
    id: "short-fragment",
    label: "Short fragment",
    weight: 1,
    tip: "\"And that matters.\" A tiny sentence dropped in for emphasis, usually after a long one.",
    find: (_t, { sentences }) =>
      sentences
        .filter((s) => s.index >= 1 && s.words >= 1 && s.words <= 3 && /[.!]["”’)]*$/.test(s.text) && !/^[-*•#\d]/.test(s.text))
        .map((s) => [s.start, s.end] as Span),
  },
  {
    id: "markdown",
    label: "Markdown",
    weight: 2,
    tip: "Headings, bold labels and bullets in what should be prose.",
    find: (t) => [...all(/^[ \t]*(?:#{1,6}[ \t]|[-*•][ \t]|\d+\.[ \t])/gmu, t), ...all(/\*\*[^*\n]+\*\*/gu, t)],
  },
  {
    id: "emoji",
    label: "Emoji",
    weight: 1,
    tip: "Rockets and sparkles: decoration a person rarely types in prose.",
    find: (t) => all(/\p{Extended_Pictographic}/gu, t),
  },
];

export const RULE_BY_ID = Object.fromEntries(RULES.map((r) => [r.id, r])) as Record<RuleId, Rule>;

export interface Tier {
  max: number;
  title: string;
  blurb: string;
}

export const TIERS: Tier[] = [
  { max: 15, title: "Reads human", blurb: "Clean. Careful human writers land here." },
  { max: 40, title: "Lightly polished", blurb: "A few tics. Could be a person on deadline, could be a model on a leash." },
  { max: 80, title: "Assistant-adjacent", blurb: "The habits are showing. Someone, or something, is trying to sound helpful." },
  { max: 150, title: "Certified slop", blurb: "This is how a stock chatbot writes. The average is about 120." },
  { max: Infinity, title: "Pure slop", blurb: "Every trick in the book, several times a paragraph." },
];

export function tierFor(score: number): Tier {
  return TIERS.find((t) => score < t.max) ?? TIERS[TIERS.length - 1]!;
}

export interface RuleCount {
  rule: Rule;
  count: number;
  points: number;
}

export interface Result {
  words: number;
  marks: Mark[];
  points: number;
  /** Weighted tics per 1000 words. */
  score: number;
  tier: Tier;
  counts: RuleCount[];
  sentences: Sentence[];
}

/** Overlapping or touching spans from one rule count once. */
function merge(spans: Span[]): Span[] {
  const sorted = [...spans].sort((a, b) => a[0] - b[0] || b[1] - a[1]);
  const out: Span[] = [];
  for (const s of sorted) {
    const last = out[out.length - 1];
    if (last && s[0] < last[1]) last[1] = Math.max(last[1], s[1]);
    else out.push([s[0], s[1]]);
  }
  return out;
}

export function detect(text: string, enabled?: ReadonlySet<RuleId>): Result {
  const sentences = splitSentences(text);
  const ctx = { sentences };
  const marks: Mark[] = [];
  const counts: RuleCount[] = [];
  let points = 0;
  for (const rule of RULES) {
    if (enabled && !enabled.has(rule.id)) continue;
    const spans = merge(rule.find(text, ctx).filter(([a, b]) => b > a));
    for (const [start, end] of spans) marks.push({ start, end, rule: rule.id });
    if (spans.length) counts.push({ rule, count: spans.length, points: spans.length * rule.weight });
    points += spans.length * rule.weight;
  }
  marks.sort((a, b) => a.start - b.start || a.end - b.end);
  counts.sort((a, b) => b.points - a.points);
  const w = countWords(text);
  const score = w ? Math.round(((points * 1000) / w) * 10) / 10 : 0;
  return { words: w, marks, points, score, tier: tierFor(score), counts, sentences };
}

export interface Segment {
  text: string;
  start: number;
  rules: RuleId[];
}

/** Cuts text at every mark boundary so overlapping marks can be drawn as stacked highlights. */
export function segments(text: string, marks: Mark[]): Segment[] {
  const cuts = new Set([0, text.length]);
  for (const m of marks) {
    cuts.add(m.start);
    cuts.add(m.end);
  }
  const points = [...cuts].sort((a, b) => a - b);
  const out: Segment[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!, b = points[i + 1]!;
    if (a === b) continue;
    const rules = marks.filter((m) => m.start <= a && m.end >= b).map((m) => m.rule);
    out.push({ text: text.slice(a, b), start: a, rules });
  }
  return out;
}

export function formatScore(score: number): string {
  return score >= 100 ? String(Math.round(score)) : score.toFixed(1).replace(/\.0$/, "");
}
