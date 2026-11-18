/**
 * Stock Yardage data model. No DOM.
 *
 * A player has a bag of clubs they define themselves. Shots are logged per
 * club, tee or no tee, at a venue, and flagged good or mishit. The card uses
 * the latest GOOD_SHOTS good shots for each club and tee setting.
 */

export const GOOD_SHOTS = 5;

/** Club keys dandenney.com's /golf uses. A custom club can map to one, or none. */
export const SITE_CLUBS = [
  "driver", "3w", "5w", "hybrid",
  "4i", "5i", "6i", "7i", "8i", "9i",
  "pw", "gw", "sw", "lw", "putter",
] as const;
export type SiteClub = (typeof SITE_CLUBS)[number];

export interface ClubDef {
  id: string;
  /** "7 Wood", "52° Wedge" */
  label: string;
  /** Up to 3 chars for the card: "7W", "52" */
  short: string;
  /** Matching key on dandenney.com, when there is one */
  site?: SiteClub;
}

export interface Player {
  id: string;
  name: string;
  /** Bag order, longest club first */
  clubs: ClubDef[];
}

export const VENUES = ["golftec", "topgolf", "range", "course"] as const;
export type Venue = (typeof VENUES)[number];

export const VENUE_LABEL: Record<Venue, string> = {
  golftec: "GOLFTEC",
  topgolf: "Topgolf",
  range: "Range",
  course: "Course",
};

export const VENUE_HINT: Record<Venue, string> = {
  golftec: "launch monitor",
  topgolf: "Toptracer",
  range: "posted signs",
  course: "GPS or lasered",
};

export interface Shot {
  id: string;
  playerId: string;
  clubId: string;
  tee: boolean;
  venue: Venue;
  /** yards */
  carry?: number;
  /** yards */
  total?: number;
  good: boolean;
  /** ISO timestamp */
  at: string;
}

export interface State {
  players: Player[];
  shots: Shot[];
  /** Remembered between visits so a range session is one tap per shot */
  current: { playerId: string; clubId?: string; venue: Venue; tee: boolean };
}

export const PRESETS: ClubDef[] = [
  { id: "driver", label: "Driver", short: "DR", site: "driver" },
  { id: "3w", label: "3 Wood", short: "3W", site: "3w" },
  { id: "5w", label: "5 Wood", short: "5W", site: "5w" },
  { id: "7w", label: "7 Wood", short: "7W" },
  { id: "9w", label: "9 Wood", short: "9W" },
  { id: "3h", label: "3 Hybrid", short: "3H", site: "hybrid" },
  { id: "4h", label: "4 Hybrid", short: "4H", site: "hybrid" },
  { id: "5h", label: "5 Hybrid", short: "5H", site: "hybrid" },
  { id: "4i", label: "4 Iron", short: "4I", site: "4i" },
  { id: "5i", label: "5 Iron", short: "5I", site: "5i" },
  { id: "6i", label: "6 Iron", short: "6I", site: "6i" },
  { id: "7i", label: "7 Iron", short: "7I", site: "7i" },
  { id: "8i", label: "8 Iron", short: "8I", site: "8i" },
  { id: "9i", label: "9 Iron", short: "9I", site: "9i" },
  { id: "pw", label: "Pitching Wedge", short: "PW", site: "pw" },
  { id: "gw", label: "Gap Wedge", short: "GW", site: "gw" },
  { id: "sw", label: "Sand Wedge", short: "SW", site: "sw" },
  { id: "lw", label: "Lob Wedge", short: "LW", site: "lw" },
];

const STANDARD_SET = ["driver", "3w", "5h", "5i", "6i", "7i", "8i", "9i", "pw", "gw", "sw"];

/** Rough loft from a club's name, for slotting new clubs into bag order. Undefined when the name doesn't say. */
export function loftOf(label: string): number | undefined {
  const l = label.toLowerCase();
  if (/putt/.test(l)) return 80;
  if (/driver|^dr$/.test(l)) return 10;
  const deg = l.match(/\b(\d{2})\s*°?\s*(deg|wedge|w)?\b/);
  if (deg && (l.includes("°") || /deg|wedge/.test(l) || Number(deg[1]) >= 40)) return Number(deg[1]);
  const n = l.match(/(\d{1,2})\s*-?\s*(wood|w|hybrid|hy|h|rescue|iron|i)\b/);
  if (n) {
    const k = Number(n[1]);
    const kind = n[2]![0];
    if (kind === "w") return 10.5 + 1.5 * k;
    if (kind === "h" || kind === "r") return 10 + 3 * k;
    return 9 + 3.5 * k;
  }
  if (/pitch|^pw$/.test(l)) return 45;
  if (/gap|approach|^gw$|^aw$/.test(l)) return 50;
  if (/sand|^sw$/.test(l)) return 56;
  if (/lob|^lw$/.test(l)) return 60;
  return undefined;
}

export function standardBag(): ClubDef[] {
  return STANDARD_SET.map((id) => ({ ...PRESETS.find((p) => p.id === id)! }));
}

export function initialState(): State {
  return {
    players: [
      { id: "dan", name: "Dan", clubs: standardBag() },
      { id: "misty", name: "Misty", clubs: standardBag() },
    ],
    shots: [],
    current: { playerId: "dan", venue: "range", tee: false },
  };
}

export function slugify(s: string): string {
  return (
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/°/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "club"
  );
}

/** "52° Wedge" → "52", "7 Wood" → "7W", "Driver" → "DR" */
export function shortFor(label: string): string {
  const t = label.trim();
  const preset = PRESETS.find((p) => p.label.toLowerCase() === t.toLowerCase());
  if (preset) return preset.short;
  const deg = t.match(/(\d{2})\s*°?/);
  if (deg && /wedge|°/i.test(t)) return deg[1]!;
  const num = t.match(/^(\d+)\s*([a-z])/i);
  if (num) return (num[1]! + num[2]!).toUpperCase();
  return t.replace(/[^a-z0-9]/gi, "").slice(0, 2).toUpperCase() || "?";
}

export function uniqueId(base: string, taken: Iterable<string>): string {
  const set = new Set(taken);
  let id = base;
  for (let n = 2; set.has(id); n++) id = `${base}-${n}`;
  return id;
}

export function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Yards entered by hand: whole numbers, 1 to 450. */
export function parseYards(raw: string): number | undefined {
  const n = Number(raw.trim());
  if (!raw.trim() || !Number.isFinite(n)) return undefined;
  const r = Math.round(n);
  return r >= 1 && r <= 450 ? r : undefined;
}
