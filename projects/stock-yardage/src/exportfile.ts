/**
 * The export file. dandenney.com's /golf reads this format
 * (scripts/golf/import-yardages.ts there), and the app imports it back to
 * move data between phones. Bump FORMAT_VERSION if the shape changes.
 */
import { GOOD_SHOTS, VENUES, type Player, type Shot, type SiteClub, type State, type Venue } from "./model.ts";
import { byVenue, clubSpread, forClub, type Spread } from "./stats.ts";

export const FORMAT = "stock-yardage";
export const FORMAT_VERSION = 1;

type SpreadOut = Omit<Spread, "shots">;

export interface ExportClub {
  id: string;
  label: string;
  short: string;
  site?: SiteClub;
  carry: { tee?: SpreadOut; ground?: SpreadOut };
  total: { tee?: SpreadOut; ground?: SpreadOut };
  /** Carry by venue, tee and ground pooled */
  venues: Partial<Record<Venue, SpreadOut>>;
}

export interface ExportFile {
  format: typeof FORMAT;
  version: number;
  exportedAt: string;
  goodShots: number;
  players: (Player & { card: ExportClub[] })[];
  shots: Shot[];
}

const strip = (s?: Spread): SpreadOut | undefined => (s ? { low: s.low, typical: s.typical, high: s.high, n: s.n } : undefined);

export function buildExport(state: State, now = new Date()): ExportFile {
  return {
    format: FORMAT,
    version: FORMAT_VERSION,
    exportedAt: now.toISOString(),
    goodShots: GOOD_SHOTS,
    players: state.players.map((p) => ({
      ...p,
      card: p.clubs.map((c) => {
        const carry = clubSpread(state.shots, p.id, c.id, "carry");
        const total = clubSpread(state.shots, p.id, c.id, "total");
        const venues = Object.fromEntries(
          Object.entries(byVenue(forClub(state.shots, p.id, c.id), "carry")).map(([k, v]) => [k, strip(v)]),
        ) as ExportClub["venues"];
        return {
          id: c.id,
          label: c.label,
          short: c.short,
          ...(c.site ? { site: c.site } : {}),
          carry: { tee: strip(carry.tee), ground: strip(carry.ground) },
          total: { tee: strip(total.tee), ground: strip(total.ground) },
          venues,
        };
      }),
    })),
    shots: [...state.shots].sort((a, b) => (a.at < b.at ? -1 : 1)),
  };
}

const isNum = (v: unknown) => v === undefined || (typeof v === "number" && Number.isFinite(v));

/** Parse and validate an export file. Throws with a readable message. */
export function parseExport(text: string): { players: Player[]; shots: Shot[] } {
  let data: Partial<ExportFile>;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("That file isn't JSON.");
  }
  if (data.format !== FORMAT) throw new Error("That isn't a Stock Yardage export.");
  if ((data.version ?? 0) > FORMAT_VERSION) throw new Error("That export is from a newer version. Reload the app.");
  const players: Player[] = (data.players ?? []).map((p) => ({
    id: String(p.id),
    name: String(p.name),
    clubs: (p.clubs ?? []).map((c) => ({
      id: String(c.id),
      label: String(c.label),
      short: String(c.short),
      ...(c.site ? { site: c.site } : {}),
    })),
  }));
  const shots = (data.shots ?? []).filter(
    (s): s is Shot =>
      typeof s?.id === "string" &&
      typeof s.playerId === "string" &&
      typeof s.clubId === "string" &&
      typeof s.tee === "boolean" &&
      typeof s.good === "boolean" &&
      typeof s.at === "string" &&
      VENUES.includes(s.venue) &&
      isNum(s.carry) &&
      isNum(s.total),
  );
  return { players, shots };
}

export function exportName(now = new Date()): string {
  return `stock-yardage-${now.toISOString().slice(0, 10)}.json`;
}
