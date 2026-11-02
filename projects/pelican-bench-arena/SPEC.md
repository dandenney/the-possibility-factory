# Pelican Bench Arena: Gemini 4 vs Muse vs Open Weights

Idea #6 from the factory board (origin: automation, shortlisted by Dan).

## Pitch

A small web app that runs the same "pelican riding a bicycle" SVG prompt across newly released models (Gemini 4
Argon, Muse Spark Open, LFM2.5, Beam via OpenRouter/HF) and shows the results side by side. Visitors vote blind on
which is best and see an Elo leaderboard.

## Why now

Gemini 4 Argon, Muse Spark Open and Beam all landed this week, and Simon Willison's pelican tests are already the
informal community benchmark. A fast blind-vote arena makes the comparison fun and shareable.

## Sparked by

- [Gemini 4 Argon: Built to solve your hardest problems](https://deepmind.google/blog/introducing-gemini-4-argon/)
- [Welcome Muse Spark Open](https://huggingface.co/blog/meta-muse-spark-open) and [Meta's post](https://research.meta.ai/blog/muse-spark-open)
- [Run fast, private agents on-device with LFM2.5-24B-A2B](https://huggingface.co/blog/LiquidAI/lfm25-24b-a2b)
- [Welcome Beam: a 501B open model](https://huggingface.co/blog/reflection-beam)
- Simon Willison: [llm-gemini 0.35](https://simonwillison.net/2026/Oct/13/llm-gemini/), [llm-meta-ai 0.2](https://simonwillison.net/2026/Oct/12/llm-meta-ai/)

## Scope for v0.1

- Pelicans are generated ahead of time, not live: `pnpm generate` sends Simon's exact prompt to every model in
  `models.json` through OpenRouter (one key covers every lab), sanitizes the SVG, and commits it. Visitors never
  trigger a model call, so there's no key in the browser and no runaway bill.
- The four featured new models plus six reference models, 3 samples each.
- Blind A/B matchup with A / Tie / B, reveal on vote, keyboard shortcuts. Most matchups include a new model.
- Votes go to a Netlify Function and are stored one blob per vote in Netlify Blobs. The leaderboard is a
  Bradley-Terry fit on an Elo-like scale (LMArena-style), with an "everyone" tab and a "just you" tab kept in
  localStorage.
- Gallery of every pelican by model, with tokens and time per drawing.
- A manual GitHub Action regenerates pelicans when a new model is added to `models.json`.
- Mobile-first, shareable link with an og:image.
