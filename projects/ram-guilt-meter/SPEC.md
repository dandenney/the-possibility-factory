# RAM Guilt Meter: Is Your Browser Tab Stealing Altman's DRAM?

Idea #90 from the factory board (origin: automation, shortlisted by Dan).

## Pitch

A joke dashboard that reads `performance.memory` and device memory in your browser and tells you how many
"data center tokens" your open tabs wasted. It adds sarcastic verdicts and a shareable guilt card. It could
include a "donate your RAM" button that closes tabs.

## Why now

Sam Altman's comment that home PCs waste scarce DRAM is a hot take on Bluesky with 2k+ posts. It's easy to
riff on with a quick, shareable gag.

## Scope for v0.1

- Static Vite + TypeScript page, no runtime dependencies, nothing leaves the browser.
- Reads what browsers expose: `navigator.deviceMemory`, `navigator.hardwareConcurrency`, `performance.memory`, and
  `performance.measureUserAgentSpecificMemory()` (served cross-origin isolated so Chromium allows it). Pages can't
  see other tabs, so you confess your tab count, pick a tab weight, and confirm your RAM.
- Converts hoarded RAM into KV-cache tokens for a 70B-class model, chatbot replies, and DDR5 dies, then a 0–100
  guilt score with five sarcastic tiers.
- A 1200×630 canvas guilt card: native share with the PNG where supported, otherwise share or copy a link that
  reproduces the card, plus a download.
- "Donate your RAM": a fake shipping sequence that asks the browser to close tabs (it can't), drops you to one tab,
  and stamps your card "RAM DONOR".
- Mobile-first, satire disclaimer, not affiliated with OpenAI.
