/** Parse ESPN's public college football endpoints into what the replay needs. */

const BASE = "https://site.api.espn.com/apis/site/v2/sports/football/college-football";

export const FIELD_WIDTH = 160 / 3; // 53⅓ yards

export interface Team {
  id: string;
  abbr: string;
  name: string;
  shortName: string;
  color: string;
  altColor: string;
  logo?: string;
}

export type PlayKind = "rush" | "pass" | "kick" | "punt" | "fg" | "other";

export interface Play {
  id: string;
  period: number;
  clock: string;
  type: string;
  text: string;
  kind: PlayKind;
  /** Team on offense when the play started. */
  offense: "home" | "away" | undefined;
  /** Yards from the home goal line (0) to the away goal line (100). */
  startX: number;
  endX: number;
  /** Across the field, 0..FIELD_WIDTH. */
  lane: number;
  yards: number;
  homeScore: number;
  awayScore: number;
  downText?: string;
  /** Line to gain after this play, from the home goal line, when there is one. */
  firstDownX?: number;
  scoring: boolean;
  drive: number;
  homeWinPct?: number;
}

export interface Game {
  id: string;
  state: "pre" | "in" | "post";
  detail: string;
  shortDetail: string;
  date: string;
  home: Team;
  away: Team;
  homeScore: number;
  awayScore: number;
  plays: Play[];
}

export interface ScoreboardGame {
  id: string;
  name: string;
  shortName: string;
  state: "pre" | "in" | "post";
  detail: string;
  date: string;
  home: { abbr: string; score: number };
  away: { abbr: string; score: number };
}

// ESPN's JSON is loosely typed; we only read a handful of fields.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

function parseTeam(t: Json): Team {
  return {
    id: String(t.id),
    abbr: t.abbreviation ?? "???",
    name: t.displayName ?? t.name ?? "Unknown",
    shortName: t.shortDisplayName ?? t.location ?? t.abbreviation ?? "",
    color: t.color ?? "555555",
    altColor: t.alternateColor ?? "ffffff",
    logo: t.logos?.[0]?.href ?? t.logo,
  };
}

function playKind(type: string): PlayKind {
  const t = type.toLowerCase();
  if (t.includes("kickoff")) return "kick";
  if (t.includes("punt")) return "punt";
  if (t.includes("field goal")) return "fg";
  if (t.includes("pass") || t.includes("sack") || t.includes("interception")) return "pass";
  if (t.includes("rush") || t.includes("fumble") || t.includes("two-point") || t.includes("safety")) return "rush";
  return "other";
}

/** Small deterministic jitter so plays to the same spot don't stack exactly. */
function jitter(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return ((h >>> 0) % 1000) / 1000 - 0.5;
}

export function laneFor(text: string, id: string): number {
  const mid = FIELD_WIDTH / 2;
  const t = text.toLowerCase();
  const side = /\b(left end|deep left|short left|left)\b/.test(t) ? -1 : /\b(right end|deep right|short right|right)\b/.test(t) ? 1 : 0;
  const wide = /\b(end|deep)\b/.test(t) ? 1.35 : 1;
  return Math.max(3, Math.min(FIELD_WIDTH - 3, mid + side * 13 * wide + jitter(id) * 6));
}

/** Convert ESPN's possession-relative position to yards from the home goal line. */
export function fieldX(spot: Json, homeId: string): number | undefined {
  if (!spot) return undefined;
  const team = spot.team?.id != null ? String(spot.team.id) : undefined;
  const ytez = typeof spot.yardsToEndzone === "number" ? spot.yardsToEndzone : undefined;
  if (team && ytez != null && ytez >= 0 && ytez <= 100) return team === homeId ? 100 - ytez : ytez;
  if (typeof spot.yardLine === "number" && spot.yardLine >= 0 && spot.yardLine <= 100) return spot.yardLine;
  return undefined;
}

export function parseSummary(json: Json): Game {
  const comp = json.header.competitions[0];
  const homeC = comp.competitors.find((c: Json) => c.homeAway === "home");
  const awayC = comp.competitors.find((c: Json) => c.homeAway === "away");
  const home = parseTeam(homeC.team);
  const away = parseTeam(awayC.team);
  const wp = new Map<string, number>((json.winprobability ?? []).map((w: Json) => [String(w.playId), w.homeWinPercentage]));
  const drives: Json[] = [...(json.drives?.previous ?? [])];
  const current = json.drives?.current;
  if (current?.plays?.length && !drives.some((d) => d.id === current.id)) drives.push(current);

  const plays: Play[] = [];
  let lastX = 35;
  let homeScore = 0;
  let awayScore = 0;
  drives.forEach((drive, driveIndex) => {
    for (const p of drive.plays ?? []) {
      const type: string = p.type?.text ?? "Play";
      const text: string = p.text ?? type;
      const offenseId = p.start?.team?.id != null ? String(p.start.team.id) : undefined;
      const offense = offenseId === home.id ? "home" : offenseId === away.id ? "away" : undefined;
      const startX = fieldX(p.start, home.id) ?? lastX;
      let endX = fieldX(p.end, home.id) ?? startX;
      const kind = playKind(type);
      const scoring = Boolean(p.scoringPlay);
      if (scoring && /touchdown/i.test(type) && offense) endX = offense === "home" ? 100 : 0;
      homeScore = typeof p.homeScore === "number" ? p.homeScore : homeScore;
      awayScore = typeof p.awayScore === "number" ? p.awayScore : awayScore;
      const endTeam = p.end?.team?.id != null ? String(p.end.team.id) : offenseId;
      const toGain = p.end?.distance;
      let firstDownX: number | undefined;
      if (typeof toGain === "number" && toGain > 0 && kind !== "kick" && kind !== "punt" && !scoring) {
        firstDownX = endTeam === home.id ? Math.min(100, endX + toGain) : Math.max(0, endX - toGain);
      }
      plays.push({
        id: String(p.id),
        period: p.period?.number ?? 1,
        clock: p.clock?.displayValue ?? "",
        type,
        text,
        kind,
        offense,
        startX,
        endX,
        lane: laneFor(text, String(p.id)),
        yards: typeof p.statYardage === "number" ? p.statYardage : 0,
        homeScore,
        awayScore,
        downText: p.end?.downDistanceText,
        firstDownX,
        scoring,
        drive: driveIndex,
        homeWinPct: wp.get(String(p.id)),
      });
      lastX = endX;
    }
  });

  const status = comp.status ?? json.header?.competitions?.[0]?.status;
  return {
    id: String(json.header.id),
    state: status?.type?.state ?? "pre",
    detail: status?.type?.detail ?? "",
    shortDetail: status?.type?.shortDetail ?? "",
    date: comp.date,
    home,
    away,
    homeScore: Number(homeC.score ?? homeScore) || 0,
    awayScore: Number(awayC.score ?? awayScore) || 0,
    plays,
  };
}

export function parseScoreboard(json: Json): ScoreboardGame[] {
  return (json.events ?? []).map((e: Json) => {
    const comp = e.competitions[0];
    const side = (h: string) => {
      const c = comp.competitors.find((x: Json) => x.homeAway === h);
      return { abbr: c?.team?.abbreviation ?? "?", score: Number(c?.score ?? 0) || 0 };
    };
    return {
      id: String(e.id),
      name: e.name,
      shortName: e.shortName,
      state: e.status?.type?.state ?? "pre",
      detail: e.status?.type?.shortDetail ?? "",
      date: e.date,
      home: side("home"),
      away: side("away"),
    };
  });
}

export async function fetchGame(eventId: string, signal?: AbortSignal): Promise<Game> {
  const res = await fetch(`${BASE}/summary?event=${encodeURIComponent(eventId)}`, { signal, cache: "no-store" });
  if (!res.ok) throw new Error(`ESPN returned ${res.status} for event ${eventId}`);
  return parseSummary(await res.json());
}

/** `date` as YYYYMMDD. FBS only (group 80). */
export async function fetchScoreboard(date: string, signal?: AbortSignal): Promise<ScoreboardGame[]> {
  const res = await fetch(`${BASE}/scoreboard?dates=${date}&groups=80&limit=300`, { signal, cache: "no-store" });
  if (!res.ok) throw new Error(`ESPN scoreboard returned ${res.status}`);
  const order = { in: 0, pre: 1, post: 2 } as const;
  return parseScoreboard(await res.json()).sort((a, b) => order[a.state] - order[b.state] || a.date.localeCompare(b.date));
}
