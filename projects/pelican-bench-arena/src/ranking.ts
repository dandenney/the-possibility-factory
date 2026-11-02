import type { Outcome, Standing, Vote } from "./types.ts";

const SLUG = /^[a-z0-9.-]+$/;
const OUTCOMES: Outcome[] = ["a", "b", "tie"];

export function isSlug(value: unknown): value is string {
  return typeof value === "string" && value.length <= 64 && SLUG.test(value);
}

/** Votes are stored one blob per vote with the result encoded in the key, so listing keys is enough to rank. */
export function voteKey(vote: Vote, now = Date.now(), nonce = Math.random().toString(36).slice(2, 10)): string {
  return `v/${vote.a}_${vote.b}_${vote.outcome}_${now.toString(36)}${nonce}`;
}

export function parseVoteKey(key: string): Vote | null {
  const parts = key.replace(/^v\//, "").split("_");
  if (parts.length !== 4) return null;
  const [a, b, outcome] = parts as [string, string, string];
  if (!isSlug(a) || !isSlug(b) || a === b || !OUTCOMES.includes(outcome as Outcome)) return null;
  return { a, b, outcome: outcome as Outcome };
}

/**
 * Bradley-Terry strengths (MM algorithm) on an Elo-like scale, the same idea LMArena uses.
 * Ties count as half a win each way. Every model also plays one virtual tie against an anchor
 * so an unbeaten or winless model stays finite.
 */
export function rank(models: string[], votes: Vote[], iterations = 200): Standing[] {
  const index = new Map(models.map((m, i) => [m, i]));
  const n = models.length;
  const wins = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  const record = models.map(() => ({ wins: 0, losses: 0, ties: 0 }));

  for (const v of votes) {
    const i = index.get(v.a);
    const j = index.get(v.b);
    if (i === undefined || j === undefined || i === j) continue;
    if (v.outcome === "a") {
      wins[i]![j]! += 1;
      record[i]!.wins++;
      record[j]!.losses++;
    } else if (v.outcome === "b") {
      wins[j]![i]! += 1;
      record[j]!.wins++;
      record[i]!.losses++;
    } else {
      wins[i]![j]! += 0.5;
      wins[j]![i]! += 0.5;
      record[i]!.ties++;
      record[j]!.ties++;
    }
  }

  const prior = 0.5;
  let p = new Array<number>(n).fill(1);
  for (let it = 0; it < iterations; it++) {
    const next = p.map((pi, i) => {
      let w = prior;
      let denom = (2 * prior) / (pi + 1);
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const games = wins[i]![j]! + wins[j]![i]!;
        w += wins[i]![j]!;
        if (games > 0) denom += games / (pi + p[j]!);
      }
      return w / denom;
    });
    p = next;
  }

  const logMean = p.reduce((s, x) => s + Math.log10(x), 0) / Math.max(n, 1);
  return models
    .map((model, i) => {
      const r = record[i]!;
      return {
        model,
        score: Math.round(1000 + 400 * (Math.log10(p[i]!) - logMean)),
        ...r,
        votes: r.wins + r.losses + r.ties,
      };
    })
    .sort((x, y) => y.score - x.score || y.votes - x.votes || x.model.localeCompare(y.model));
}
