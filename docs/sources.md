# Signal sources

Candidate collectors for phase 2. Every one below is free and returned data from a server
with no auth (checked October 2026) unless noted.

## AI model releases (`model_release`)

| Source | Endpoint | Notes |
| --- | --- | --- |
| OpenRouter models | `https://openrouter.ai/api/v1/models` | JSON with a `created` timestamp per model. Best single "new model shipped" feed across labs. |
| Hugging Face trending | `https://huggingface.co/api/models?sort=trendingScore` and `/api/spaces?sort=trendingScore` | Open-weight models and demo apps people are excited about. |
| OpenAI news | `https://openai.com/news/rss.xml` | RSS. |
| Google DeepMind | `https://deepmind.google/blog/rss.xml` | RSS. |
| Google AI blog | `https://blog.google/technology/ai/rss/` | RSS. |
| Hugging Face blog | `https://huggingface.co/blog/feed.xml` | RSS. |
| Anthropic news | `https://www.anthropic.com/news` | No RSS feed (`/news/rss.xml` 404s). Scrape `/news/<slug>` links from the HTML, or rely on OpenRouter + GitHub releases. |
| r/LocalLLaMA | `https://www.reddit.com/r/LocalLLaMA/top/.rss?t=day` | Atom. Reddit may rate-limit or block cloud IPs; treat as best-effort. |

## Engineering tooling releases (`tooling_release`)

| Source | Endpoint | Notes |
| --- | --- | --- |
| GitHub releases | `https://github.com/<owner>/<repo>/releases.atom` | One feed per repo, no auth. Keep a watchlist (e.g. `anthropics/claude-code`, `withastro/astro`, `oven-sh/bun`, `vercel/next.js`). |
| GitHub new + rising repos | `https://api.github.com/search/repositories?q=created:>YYYY-MM-DD&sort=stars` | 10 req/min unauthenticated; use a `GITHUB_TOKEN` in Actions. |
| Hacker News | `https://hnrss.org/frontpage?points=200`, `https://news.ycombinator.com/showrss` | Front page above a points threshold, plus Show HN. Algolia API (`hn.algolia.com/api/v1`) for filtering. |
| Lobsters | `https://lobste.rs/rss` | RSS. |
| Product Hunt | `https://www.producthunt.com/feed` | Atom. |
| Simon Willison | `https://simonwillison.net/atom/everything/` | High signal on new AI tooling. |

## Pop culture and trends (`culture`)

| Source | Endpoint | Notes |
| --- | --- | --- |
| Bluesky trends | `https://public.api.bsky.app/xrpc/app.bsky.unspecced.getTrends` | **Replacement for X trends.** Public, no auth, returns topic, category (`entertainment`, `sports`, `science-tech`, ...) and post count. Endpoint is "unspecced", so it may change. |
| Google Trends daily | `https://trends.google.com/trending/rss?geo=US` | RSS of trending searches with approximate traffic and news links. |
| Wikipedia top pages | `https://wikimedia.org/api/rest_v1/metrics/pageviews/top/en.wikipedia/all-access/YYYY/MM/DD` | What people actually read yesterday; filter out evergreen pages (Main_Page, Special:*). |
| YouTube channels | `https://www.youtube.com/feeds/videos.xml?channel_id=<id>` | Atom per channel; good for interest-specific creators. |

### X (Twitter)

Not recommended. The X API is paid (the docs now describe pay-per-use pricing) and
needs an approved developer account. Bluesky trends + Google Trends + Wikipedia cover the
"what's everyone talking about" need for free.

## Interests (`interest`)

Driven by an editable interests profile (topics, subreddits, YouTube channels, GitHub
repos). Collectors are the same feed types above, parameterized by the profile, so adding
an interest is configuration, not code.

## Collector plan

- Run on a GitHub Actions schedule (e.g. every 6 hours) with `DATABASE_URL` and
  `DATABASE_AUTH_TOKEN` secrets; write with `upsertSignals` so reruns dedupe on
  `(source, externalId)`.
- Start with OpenRouter, GitHub releases, HN, Bluesky trends, and Google Trends; add the
  rest once noise levels are known.
- High-volume trend feeds should go through a cheap LLM relevance filter against the
  interests profile before becoming signals.
