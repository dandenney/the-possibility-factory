import { GOOD_SHOTS, VENUES, type Shot, type Venue } from "./model.ts";

export type Metric = "carry" | "total";

export interface Spread {
  low: number;
  typical: number;
  high: number;
  /** Good shots in the window, up to GOOD_SHOTS */
  n: number;
  shots: Shot[];
}

export function median(values: number[]): number {
  const v = [...values].sort((a, b) => a - b);
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid]! : Math.round((v[mid - 1]! + v[mid]!) / 2);
}

const newestFirst = (a: Shot, b: Shot) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0);

/** The latest good shots that have the metric, newest first. */
export function window(shots: Shot[], metric: Metric, size = GOOD_SHOTS): Shot[] {
  return shots
    .filter((s) => s.good && typeof s[metric] === "number")
    .sort(newestFirst)
    .slice(0, size);
}

export function spread(shots: Shot[], metric: Metric, size = GOOD_SHOTS): Spread | undefined {
  const w = window(shots, metric, size);
  if (!w.length) return undefined;
  const v = w.map((s) => s[metric]!);
  return { low: Math.min(...v), typical: median(v), high: Math.max(...v), n: w.length, shots: w };
}

export interface ClubSpread {
  tee?: Spread;
  ground?: Spread;
}

export function forClub(shots: Shot[], playerId: string, clubId: string): Shot[] {
  return shots.filter((s) => s.playerId === playerId && s.clubId === clubId);
}

export function clubSpread(shots: Shot[], playerId: string, clubId: string, metric: Metric): ClubSpread {
  const mine = forClub(shots, playerId, clubId);
  return {
    tee: spread(mine.filter((s) => s.tee), metric),
    ground: spread(mine.filter((s) => !s.tee), metric),
  };
}

/** Per venue, the same club and tee setting: how far apart the readings are. */
export function byVenue(shots: Shot[], metric: Metric): Partial<Record<Venue, Spread>> {
  const out: Partial<Record<Venue, Spread>> = {};
  for (const v of VENUES) {
    const s = spread(shots.filter((x) => x.venue === v), metric);
    if (s) out[v] = s;
  }
  return out;
}

/** Typical at each venue minus typical on the course. Positive = venue reads long. */
export function venueGap(per: Partial<Record<Venue, Spread>>, venue: Venue): number | undefined {
  const course = per.course;
  const here = per[venue];
  if (!course || !here || venue === "course") return undefined;
  return here.typical - course.typical;
}

/** Shared axis for the card so every club sits on one yardage scale. */
export function axis(spreads: (Spread | undefined)[], step = 25): { min: number; max: number; step: number } {
  const vals = spreads.flatMap((s) => (s ? [s.low, s.high] : []));
  if (!vals.length) return { min: 0, max: 250, step: 50 };
  const lo = Math.max(0, Math.floor((Math.min(...vals) - 5) / step) * step);
  const hi = Math.ceil((Math.max(...vals) + 5) / step) * step;
  const max = Math.max(hi, lo + step * 2);
  return { min: lo, max, step: max - lo > 200 ? step * 2 : step };
}
