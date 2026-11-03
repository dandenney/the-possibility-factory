import { RULE_BY_ID, tierFor, type Result, type RuleId } from "./detect.ts";

export interface SharedScore {
  score: number;
  words: number;
  counts: [RuleId, number][];
}

export function encodeScore(r: Result): string {
  const p = new URLSearchParams({ s: String(r.score), w: String(r.words) });
  if (r.counts.length) p.set("c", r.counts.map((c) => `${c.rule.id}.${c.count}`).join("_"));
  return p.toString();
}

export function decodeScore(search: string): SharedScore | undefined {
  const p = new URLSearchParams(search);
  const score = Number(p.get("s"));
  const words = Number(p.get("w"));
  if (!p.has("s") || !Number.isFinite(score) || score < 0 || !Number.isFinite(words) || words <= 0) return undefined;
  const counts: [RuleId, number][] = [];
  for (const part of (p.get("c") ?? "").split("_")) {
    const [id, n] = part.split(".");
    const count = Number(n);
    if (id && id in RULE_BY_ID && Number.isInteger(count) && count > 0) counts.push([id as RuleId, count]);
  }
  return { score: Math.min(score, 9999), words: Math.round(words), counts };
}

export function describeShared(s: SharedScore): string {
  return `${s.score} (${tierFor(s.score).title})`;
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): Uint8Array {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

/** Text goes in the URL fragment, compressed, so it never reaches a server. */
export async function encodeText(text: string): Promise<string> {
  return toBase64Url(await pipe(new TextEncoder().encode(text), new CompressionStream("deflate-raw")));
}

export async function decodeText(fragment: string): Promise<string | undefined> {
  try {
    return new TextDecoder().decode(await pipe(fromBase64Url(fragment), new DecompressionStream("deflate-raw")));
  } catch {
    return undefined;
  }
}

/** Links longer than this get unwieldy in chat apps; share the score only. */
export const MAX_TEXT_LINK = 6000;
