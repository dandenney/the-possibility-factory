import type { Collector, CollectedSignal } from "../index.ts";
import { daysAgo, fetchText, parseFeed } from "../feed.ts";

/** One collector for a watchlist of repos, so they share a source id and dedupe together. */
export function githubReleasesCollector(repos: string[], maxAgeDays = 3, perRepo = 2): Collector {
  return {
    id: "github-releases",
    kind: "tooling_release",
    async collect() {
      const since = daysAgo(maxAgeDays);
      const results = await Promise.allSettled(
        repos.map(async (repo): Promise<CollectedSignal[]> => {
          const items = parseFeed(await fetchText(`https://github.com/${repo}/releases.atom`));
          return items
            .filter((item) => item.publishedAt && item.publishedAt >= since)
            .slice(0, perRepo)
            .map((item) => ({
              externalId: item.id,
              title: `${repo} ${item.title}`,
              url: item.link ?? null,
              note: item.summary ?? null,
              publishedAt: item.publishedAt ?? null,
            }));
        }),
      );
      return results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
    },
  };
}
