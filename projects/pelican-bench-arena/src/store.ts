// Server-only: used by the Netlify Functions, never imported by the page.
import { getStore } from "@netlify/blobs";
import config from "../models.json";
import gallery from "./gallery.json";
import { parseVoteKey, rank, voteKey } from "./ranking.ts";
import type { ArenaConfig, Gallery, Standing, Vote } from "./types.ts";

const arena = config as ArenaConfig;
const samples = (gallery as Gallery).samples;
export const rankedModels = arena.models.map((m) => m.slug).filter((slug) => samples.some((s) => s.model === slug));
const known = new Set(rankedModels);

const votes = () => getStore({ name: "votes", consistency: "strong" });

export function validVote(body: unknown): Vote | null {
  if (!body || typeof body !== "object") return null;
  const { a, b, outcome } = body as Record<string, unknown>;
  if (typeof a !== "string" || typeof b !== "string" || a === b || !known.has(a) || !known.has(b)) return null;
  if (outcome !== "a" && outcome !== "b" && outcome !== "tie") return null;
  return { a, b, outcome };
}

export async function recordVote(vote: Vote): Promise<string> {
  const key = voteKey(vote);
  await votes().set(key, "");
  return key;
}

export interface Leaderboard {
  standings: Standing[];
  totalVotes: number;
  updatedAt: string;
}

export async function leaderboard(justAdded?: string): Promise<Leaderboard> {
  const all: Vote[] = [];
  let sawJustAdded = false;
  for await (const page of votes().list({ prefix: "v/", paginate: true })) {
    for (const blob of page.blobs) {
      if (blob.key === justAdded) sawJustAdded = true;
      const vote = parseVoteKey(blob.key);
      if (vote && known.has(vote.a) && known.has(vote.b)) all.push(vote);
    }
  }
  if (justAdded && !sawJustAdded) {
    const vote = parseVoteKey(justAdded);
    if (vote) all.push(vote);
  }
  return { standings: rank(rankedModels, all), totalVotes: all.length, updatedAt: new Date().toISOString() };
}
