import type { Collector } from "../index.ts";
import { daysAgo, fetchJson, stripHtml } from "../feed.ts";

interface OpenRouterModel {
  id: string;
  name: string;
  created: number;
  description?: string;
  context_length?: number;
}

/** New models across labs, using OpenRouter's per-model `created` timestamp. */
export function openRouterCollector(maxAgeDays = 3): Collector {
  return {
    id: "openrouter-models",
    kind: "model_release",
    async collect() {
      const since = daysAgo(maxAgeDays).getTime() / 1000;
      const { data } = await fetchJson<{ data: OpenRouterModel[] }>("https://openrouter.ai/api/v1/models");
      return data
        .filter((m) => m.created >= since && !m.id.endsWith(":free") && !m.id.startsWith("~"))
        .map((m) => ({
          externalId: m.id,
          title: m.name,
          url: `https://openrouter.ai/${m.id}`,
          note: stripHtml(m.description) ?? null,
          publishedAt: new Date(m.created * 1000),
        }));
    },
  };
}
