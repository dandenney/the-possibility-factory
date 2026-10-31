export type Bet =
  | { team: string; kind: "ml"; label: string }
  | { team: string; kind: "spread"; line: number; label: string };

export type BetStatus = "winning" | "losing" | "push" | "won" | "lost" | "pending";

/** Parse "IOWA ML" or "WASH +7.5" (team abbreviation as ESPN shows it). */
export function parseBet(spec: string | null | undefined): Bet | undefined {
  const m = spec?.trim().match(/^([A-Za-z&.]+)\s+(ML|[+-]\d+(?:\.\d+)?)$/i);
  if (!m) return undefined;
  const team = m[1]!.toUpperCase();
  const tail = m[2]!.toUpperCase();
  if (tail === "ML") return { team, kind: "ml", label: `${team} ML` };
  const line = Number(tail);
  return { team, kind: "spread", line, label: `${team} ${line > 0 ? "+" : ""}${line}` };
}

export interface Scoreline {
  homeAbbr: string;
  awayAbbr: string;
  homeScore: number;
  awayScore: number;
  state: "pre" | "in" | "post";
}

/** How the bet stands right now, with the cushion in points (positive = on the right side). */
export function evaluateBet(bet: Bet, s: Scoreline): { status: BetStatus; margin: number } | undefined {
  const isHome = bet.team === s.homeAbbr;
  if (!isHome && bet.team !== s.awayAbbr) return undefined;
  const mine = isHome ? s.homeScore : s.awayScore;
  const theirs = isHome ? s.awayScore : s.homeScore;
  const margin = mine - theirs + (bet.kind === "spread" ? bet.line : 0);
  if (s.state === "pre") return { status: "pending", margin };
  if (margin === 0) return { status: "push", margin };
  if (s.state === "post") return { status: margin > 0 ? "won" : "lost", margin };
  return { status: margin > 0 ? "winning" : "losing", margin };
}
