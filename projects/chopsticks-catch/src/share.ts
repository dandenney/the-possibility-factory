import type { Outcome } from "./sim.ts";

export const SITE = "https://chopsticks-catch.netlify.app";

export interface Challenge {
  flight?: number;
  score?: number;
}

export function parseChallenge(search: string): Challenge {
  const p = new URLSearchParams(search);
  const int = (v: string | null, max: number) => {
    if (!v || !/^\d{1,7}$/.test(v)) return undefined;
    const n = Number(v);
    return n >= 1 && n <= max ? n : undefined;
  };
  return { flight: int(p.get("f"), 9999999), score: int(p.get("s"), 1000) };
}

export function challengeUrl(flight: number, outcome?: Outcome, base = SITE): string {
  const url = new URL(base);
  url.searchParams.set("f", String(flight));
  if (outcome?.kind === "caught") url.searchParams.set("s", String(outcome.score));
  return url.toString();
}

export function shareText(flight: number, outcome: Outcome): string {
  if (outcome.kind === "caught") {
    return `Caught the booster on flight ${flight}: ${outcome.score} points, ${outcome.speed.toFixed(1)} m/s at the arms, ${outcome.offset.toFixed(1)} m off center. Beat it:`;
  }
  return `I lost the booster on flight ${flight} of Chopsticks Catch. You try:`;
}

export function randomFlight(): number {
  return 1 + Math.floor(Math.random() * 9998);
}
