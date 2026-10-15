import type { Collector } from "../index.ts";
import { fetchText, parseFeed, text } from "../feed.ts";

/** Google's daily trending searches RSS. Topics recur, so ids are scoped to the day. */
export function googleTrendsCollector(geo = "US"): Collector {
  return {
    id: `google-trends-${geo.toLowerCase()}`,
    kind: "culture",
    async collect() {
      const items = parseFeed(await fetchText(`https://trends.google.com/trending/rss?geo=${geo}`));
      return items.map((item) => {
        const news = item.raw["ht:news_item"];
        const first = (Array.isArray(news) ? news[0] : news) as Record<string, unknown> | undefined;
        const traffic = text(item.raw["ht:approx_traffic"]);
        const headline = text(first?.["ht:news_item_title"]);
        const day = (item.publishedAt ?? new Date()).toISOString().slice(0, 10);
        return {
          externalId: `${day}:${item.title.toLowerCase()}`,
          title: item.title,
          url: text(first?.["ht:news_item_url"]) ?? `https://www.google.com/search?q=${encodeURIComponent(item.title)}`,
          note: [traffic && `${traffic} searches`, headline].filter(Boolean).join(" · ") || null,
          publishedAt: item.publishedAt ?? null,
        };
      });
    },
  };
}
