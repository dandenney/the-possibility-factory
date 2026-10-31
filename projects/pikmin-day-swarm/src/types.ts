/** Sprout types: the five built-ins plus anything invented from a one-line prompt. */
export interface SproutType {
  id: string;
  name: string;
  /** CSS hex color, or "rainbow". */
  color: string;
  /** Multiplier on walking speed. */
  speed: number;
  /** How many carrier "units" this sprout is worth. */
  strength: number;
  swims: boolean;
  /** Multiplier on throw distance and height. */
  throwRange: number;
  /** Multiplier on body size. */
  size: number;
  glow: boolean;
  wander: boolean;
  blurb: string;
  prompt?: string;
}

const base = { speed: 1, strength: 1, swims: false, throwRange: 1, size: 1, glow: false, wander: false };

export const BUILTIN_TYPES: SproutType[] = [
  { ...base, id: "red", name: "Red", color: "#e5372c", blurb: "Sturdy all-rounders." },
  { ...base, id: "yellow", name: "Yellow", color: "#f5c518", throwRange: 1.6, size: 0.9, blurb: "Thrown highest and farthest." },
  { ...base, id: "blue", name: "Blue", color: "#2f6fe0", swims: true, blurb: "The only ones who can wade into puddles." },
  { ...base, id: "purple", name: "Purple", color: "#7b3fb8", strength: 4, speed: 0.7, size: 1.3, throwRange: 0.7, blurb: "Slow, but each one carries like four." },
  { ...base, id: "white", name: "White", color: "#f2f2ee", speed: 1.6, size: 0.8, blurb: "Fastest on their feet." },
];

const COLORS: Record<string, string> = {
  red: "#e5372c", crimson: "#c21f3a", orange: "#f28a1c", yellow: "#f5c518", gold: "#e8b923", golden: "#e8b923",
  green: "#3fb950", lime: "#9be22d", mint: "#7fe0b0", teal: "#1fa3a3", cyan: "#30c8e8", blue: "#2f6fe0",
  navy: "#2a3f8f", purple: "#7b3fb8", violet: "#8f5bd9", lavender: "#b8a3e8", pink: "#ff6fae", magenta: "#e0359a",
  white: "#f2f2ee", silver: "#c7ccd4", gray: "#8a8f98", grey: "#8a8f98", black: "#2b2b30", brown: "#8a5a32",
  peach: "#ffb38a", coral: "#ff7a6b", ghost: "#e8f0ff", pumpkin: "#ff7518", rainbow: "rainbow",
};

const has = (text: string, words: string[]) => words.some((w) => new RegExp(`\\b${w}`, "i").test(text));

function hashHue(text: string): string {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return hslToHex(h % 360, 70, 58);
}

function hslToHex(h: number, s: number, l: number): string {
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

export interface Invention {
  type: SproutType;
  count: number;
  /** Human-readable list of what we understood, e.g. ["pink", "fast", "swims"]. */
  traits: string[];
}

/** Turn "a dozen tiny pink speedy swimmers" into a sprout type. Deterministic: same prompt, same type. */
export function inventType(prompt: string): Invention {
  const text = prompt.trim().slice(0, 120);
  const lower = text.toLowerCase();
  const traits: string[] = [];
  const colorWord = Object.keys(COLORS).find((c) => new RegExp(`\\b${c}\\b`).test(lower));
  const color = colorWord ? COLORS[colorWord]! : hashHue(lower || "sprout");
  if (colorWord) traits.push(colorWord);

  const t: SproutType = { ...base, id: "", name: "", color, blurb: "", prompt: text };
  if (has(lower, ["fast", "quick", "speed", "zoom", "rapid", "swift", "hyper", "turbo"])) { t.speed = 1.7; traits.push("fast"); }
  else if (has(lower, ["slow", "lazy", "sleep", "sluggish", "chill", "tired", "snail"])) { t.speed = 0.55; traits.push("slow"); }
  if (has(lower, ["strong", "might", "buff", "beef", "muscle", "power", "heavy", "lift"])) { t.strength = 3; traits.push("strong"); }
  else if (has(lower, ["weak", "feeble", "wimpy", "noodle"])) { t.strength = 0.5; traits.push("weak"); }
  if (has(lower, ["swim", "water", "aqua", "wet", "fish", "wade", "frog", "duck", "rain"])) { t.swims = true; traits.push("swims"); }
  if (has(lower, ["fly", "flying", "float", "glid", "wing", "feather", "leaf", "light", "bounc", "jump", "high"])) { t.throwRange = 1.8; traits.push("flies far"); }
  if (has(lower, ["tiny", "small", "mini", "little", "baby", "itty"])) { t.size = 0.7; traits.push("tiny"); }
  else if (has(lower, ["big", "huge", "giant", "chonk", "chunky", "large", "jumbo", "mega"])) { t.size = 1.45; t.strength += 1; traits.push("big"); }
  if (has(lower, ["glow", "shin", "sparkl", "neon", "ghost", "spooky", "magic", "star"])) { t.glow = true; traits.push("glows"); }
  if (has(lower, ["curious", "wander", "chaos", "chaotic", "silly", "goofy", "distract", "silly", "feral"])) { t.wander = true; traits.push("wanders"); }

  const noun = t.swims ? "Paddlers" : t.speed > 1 ? "Zoomers" : t.strength >= 3 ? "Lifters" : t.throwRange > 1 ? "Gliders" : t.glow ? "Glimmers" : t.wander ? "Wanderers" : t.speed < 1 ? "Dozers" : "Sprouts";
  const adjective = colorWord ? colorWord[0]!.toUpperCase() + colorWord.slice(1) : t.size < 1 ? "Tiny" : t.size > 1 ? "Big" : "Mystery";
  t.name = `${adjective} ${noun}`;
  t.id = `custom-${slug(text || t.name)}`;
  t.blurb = traits.length ? traits.join(" · ") : "plain, honest sprouts";

  const n = lower.match(/\b(\d{1,3})\b/);
  const words: Record<string, number> = { a: 12, dozen: 12, few: 6, couple: 2, handful: 8, bunch: 20, swarm: 40, horde: 50, army: 50, hundred: 50 };
  const word = Object.keys(words).find((w) => w !== "a" && new RegExp(`\\b${w}\\b`).test(lower));
  const count = Math.max(1, Math.min(50, n ? Number(n[1]) : word ? words[word]! : 12));
  return { type: t, count, traits };
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "sprout";
}

/** Prompts are what we share in the URL; types are rebuilt from them. */
export function encodePrompts(prompts: string[]): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(prompts)))).replace(/=+$/, "");
}

export function decodePrompts(hash: string): string[] {
  try {
    const json = decodeURIComponent(escape(atob(hash)));
    const parsed: unknown = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter((p): p is string => typeof p === "string").slice(0, 8) : [];
  } catch {
    return [];
  }
}
