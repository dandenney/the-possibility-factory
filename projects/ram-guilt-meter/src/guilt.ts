// Pure math for the meter. No DOM, so it's easy to test.

/** KV cache per token for a 70B-class model with grouped-query attention in fp16:
 *  80 layers × 8 KV heads × 128 dims × 2 (K and V) × 2 bytes. */
export const KV_BYTES_PER_TOKEN = 80 * 8 * 128 * 2 * 2;
/** Roughly one chatbot answer. */
export const TOKENS_PER_REPLY = 650;
/** One 16 Gb DDR5 die holds 2 GB. */
export const GB_PER_DRAM_DIE = 2;

export const TAB_WEIGHTS = [
  { id: "lean", mb: 90, label: "Lean (docs, articles)" },
  { id: "typical", mb: 180, label: "Typical (a bit of everything)" },
  { id: "heavy", mb: 400, label: "Heavy (Figma, Gmail, YouTube)" },
] as const;
export type TabWeightId = (typeof TAB_WEIGHTS)[number]["id"];

export const DEVICE_GB_OPTIONS = [4, 8, 16, 32, 64, 128] as const;
export const MAX_TABS = 500;

export interface GuiltInput {
  tabs: number;
  weight: TabWeightId;
  deviceGb: number;
}

export interface Tier {
  min: number;
  title: string;
  quips: readonly string[];
}

export const TIERS: readonly Tier[] = [
  {
    min: 85,
    title: "Enemy of Scaling",
    quips: [
      "Somewhere in Abilene, a GPU just sighed.",
      "You are personally why the model said “I can't help with that.”",
      "Your tabs have their own power purchase agreement.",
    ],
  },
  {
    min: 60,
    title: "DRAM Bandit",
    quips: [
      "That RAM could be thinking. Instead it's holding a recipe you'll never cook.",
      "A data center is filing a missing memory report with your name on it.",
      "You're not multitasking. You're hoarding.",
    ],
  },
  {
    min: 35,
    title: "Tab Goblin",
    quips: [
      "“I'll read it later” is doing a lot of work here.",
      "Your tabs are a museum of good intentions.",
      "Not the worst we've seen. Not good, either.",
    ],
  },
  {
    min: 15,
    title: "Mild Hoarder",
    quips: [
      "A few tabs too many, but the grid will survive.",
      "Close one more and we'll call it even.",
      "You're one Wikipedia rabbit hole away from trouble.",
    ],
  },
  {
    min: 0,
    title: "Data Center Ally",
    quips: [
      "Sam thanks you for your service. Equity not included.",
      "So few tabs. Are you okay?",
      "Your RAM is practically on loan to the cloud already.",
    ],
  },
];

export interface GuiltResult {
  input: GuiltInput;
  mbPerTab: number;
  hoardedGb: number;
  shareOfDevice: number;
  kvTokens: number;
  replies: number;
  dramDies: number;
  score: number;
  tier: Tier;
  quip: string;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function normalize(input: Partial<GuiltInput>): GuiltInput {
  const tabs = Math.round(clamp(Number(input.tabs) || 1, 1, MAX_TABS));
  const weight = TAB_WEIGHTS.some((w) => w.id === input.weight) ? (input.weight as TabWeightId) : "typical";
  const gb = Number(input.deviceGb);
  const deviceGb = (DEVICE_GB_OPTIONS as readonly number[]).includes(gb) ? gb : 16;
  return { tabs, weight, deviceGb };
}

export function tierFor(score: number): Tier {
  return TIERS.find((t) => score >= t.min) ?? TIERS[TIERS.length - 1]!;
}

/** Guilt grows with tab count and with how much of the machine they eat, and saturates at 100. */
export function guiltScore(tabs: number, shareOfDevice: number): number {
  return Math.round(100 * (1 - Math.exp(-(tabs / 35 + shareOfDevice))));
}

export function computeGuilt(raw: Partial<GuiltInput>): GuiltResult {
  const input = normalize(raw);
  const mbPerTab = TAB_WEIGHTS.find((w) => w.id === input.weight)!.mb;
  const hoardedGb = (input.tabs * mbPerTab) / 1024;
  const shareOfDevice = hoardedGb / input.deviceGb;
  const kvTokens = Math.floor((hoardedGb * 1024 ** 3) / KV_BYTES_PER_TOKEN);
  const score = guiltScore(input.tabs, shareOfDevice);
  const tier = tierFor(score);
  const quip = tier.quips[(input.tabs * 7 + input.deviceGb) % tier.quips.length]!;
  return {
    input,
    mbPerTab,
    hoardedGb,
    shareOfDevice,
    kvTokens,
    replies: Math.floor(kvTokens / TOKENS_PER_REPLY),
    dramDies: hoardedGb / GB_PER_DRAM_DIE,
    score,
    tier,
    quip,
  };
}

/** Starting guess for device RAM. Chrome's navigator.deviceMemory rounds down and caps at 8. */
export function guessDeviceGb(deviceMemory: number | undefined): number {
  if (!deviceMemory || deviceMemory >= 8) return 16;
  return deviceMemory <= 4 ? 4 : 8;
}

export function encodeShare(input: GuiltInput): string {
  const p = new URLSearchParams({ t: String(input.tabs), w: input.weight, g: String(input.deviceGb) });
  return p.toString();
}

export function decodeShare(search: string): GuiltInput | undefined {
  const p = new URLSearchParams(search);
  if (!p.has("t")) return undefined;
  return normalize({ tabs: Number(p.get("t")), weight: p.get("w") as TabWeightId, deviceGb: Number(p.get("g")) });
}

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const whole = new Intl.NumberFormat("en-US");

export function formatCount(n: number): string {
  return n >= 10_000 ? compact.format(n) : whole.format(Math.round(n));
}

export function formatGb(gb: number): string {
  return gb < 1 ? `${Math.round(gb * 1024)} MB` : `${gb.toFixed(gb < 10 ? 1 : 0)} GB`;
}
