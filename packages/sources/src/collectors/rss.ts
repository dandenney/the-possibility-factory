import type { SignalKind } from "@factory/core";
import type { Collector } from "../index.ts";
import { daysAgo, fetchText, parseFeed } from "../feed.ts";

export interface RssCollectorOptions {
  id: string;
  kind: SignalKind;
  url: string;
  /** Skip items older than this many days. */
  maxAgeDays?: number;
  limit?: number;
}

export function rssCollector({ id, kind, url, maxAgeDays = 3, limit = 15 }: RssCollectorOptions): Collector {
  return {
    id,
    kind,
    async collect() {
      const since = daysAgo(maxAgeDays);
      return parseFeed(await fetchText(url))
        .filter((item) => !item.publishedAt || item.publishedAt >= since)
        .slice(0, limit)
        .map((item) => ({
          externalId: item.id,
          title: item.title,
          url: item.link ?? null,
          note: item.summary ?? null,
          publishedAt: item.publishedAt ?? null,
        }));
    },
  };
}
