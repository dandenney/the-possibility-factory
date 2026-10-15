import type { NewSignal, SignalKind } from "@factory/core";
import { blueskyTrendsCollector } from "./collectors/bluesky-trends.ts";
import { githubReleasesCollector } from "./collectors/github-releases.ts";
import { googleTrendsCollector } from "./collectors/google-trends.ts";
import { openRouterCollector } from "./collectors/openrouter.ts";
import { rssCollector } from "./collectors/rss.ts";

/** A collector fetches finds from one external source and maps them to signals. */
export interface Collector {
  /** Stable id, stored as the signal `source`, e.g. "rss:anthropic-news". */
  id: string;
  kind: SignalKind;
  collect(): Promise<CollectedSignal[]>;
}

/** Collectors must set `externalId` so repeated runs dedupe. */
export type CollectedSignal = Omit<NewSignal, "id" | "source" | "kind" | "status" | "createdAt"> & {
  externalId: string;
};

export const WATCHED_REPOS = [
  "anthropics/claude-code",
  "anthropics/anthropic-sdk-typescript",
  "openai/codex",
  "modelcontextprotocol/modelcontextprotocol",
  "withastro/astro",
  "vercel/next.js",
  "oven-sh/bun",
  "denoland/deno",
  "vitejs/vite",
  "tailwindlabs/tailwindcss",
  "drizzle-team/drizzle-orm",
  "ollama/ollama",
];

export const collectors: Collector[] = [
  openRouterCollector(),
  rssCollector({ id: "rss:openai-news", kind: "model_release", url: "https://openai.com/news/rss.xml" }),
  rssCollector({ id: "rss:deepmind-blog", kind: "model_release", url: "https://deepmind.google/blog/rss.xml" }),
  rssCollector({ id: "rss:huggingface-blog", kind: "model_release", url: "https://huggingface.co/blog/feed.xml" }),
  githubReleasesCollector(WATCHED_REPOS),
  rssCollector({ id: "rss:hn-frontpage", kind: "tooling_release", url: "https://hnrss.org/frontpage?points=200" }),
  rssCollector({ id: "rss:hn-show", kind: "tooling_release", url: "https://hnrss.org/show?points=100" }),
  rssCollector({ id: "rss:simonwillison", kind: "tooling_release", url: "https://simonwillison.net/atom/everything/" }),
  blueskyTrendsCollector(),
  googleTrendsCollector(),
];

export function toSignal(collector: Collector, item: CollectedSignal): NewSignal {
  return { ...item, source: collector.id, kind: collector.kind };
}
