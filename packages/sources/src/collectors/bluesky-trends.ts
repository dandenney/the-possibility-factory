import type { Collector } from "../index.ts";
import { fetchJson } from "../feed.ts";

interface BlueskyTrend {
  topic: string;
  displayName: string;
  description?: string;
  link: string;
  startedAt: string;
  postCount: number;
  category?: string;
}

/** Public, unauthenticated Bluesky trends: the free stand-in for X trends. */
export function blueskyTrendsCollector(limit = 25): Collector {
  return {
    id: "bluesky-trends",
    kind: "culture",
    async collect() {
      const { trends } = await fetchJson<{ trends: BlueskyTrend[] }>(
        `https://public.api.bsky.app/xrpc/app.bsky.unspecced.getTrends?limit=${limit}`,
      );
      return trends.map((t) => ({
        externalId: t.topic,
        title: t.displayName,
        url: `https://bsky.app${t.link}`,
        note: [t.description, [t.category, `${t.postCount} posts`].filter(Boolean).join(" · ")].filter(Boolean).join("\n"),
        publishedAt: new Date(t.startedAt),
      }));
    },
  };
}
