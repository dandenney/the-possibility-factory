# Artifact Sandbox Escape Kit: Test Your HTML-Preview Iframes

Idea #88 from the factory board (origin: automation, shortlisted by Dan).

## Pitch

A small test harness that renders LLM-generated HTML the way chat apps do (sandboxed iframes, srcdoc, blob URLs) and
runs a battery of harmless probes: cookie access, postMessage abuse, top navigation, and fetches to the parent
origin. It outputs a pass/fail report for devs building their own artifact or preview feature.

## Why now

Parameter Labs just showed account takeover through ChatGPT's HTML previews, and the lawyer prompt-injection
sanctions show how far untrusted model output is spreading. Anyone building an artifacts-style feature needs a quick
checklist.

## Sparked by

- [How We Took Over ChatGPT Accounts](https://simonwillison.net/2026/Oct/31/how-we-took-over-chatgpt-accounts/) (Simon Willison, linking [Parameter Labs' write-up](https://www.parameter.ai/labs/we-found-a-gap-at-openai))
- [Brazilian Court Sanctions Lawyers for Prompt Injection in Court Filing](https://jetstream.security/?p=2949)

## Scope for v0.1

- Shipped as **Sandbox Check**. Static Vite + TypeScript page, no runtime dependencies, no backend.
- Configure the frame like your app does: embed method (`srcdoc`, blob URL, `data:` URL), the `sandbox` attribute
  and each token (or no attribute at all), a CSP inside the framed HTML (none, a no-network preset, or custom), and
  the `allow` attribute. Five presets cover the usual setups and the classic `allow-scripts allow-same-origin` mistake.
- A probe page stands in for the untrusted HTML. It reports its origin and whether it can read the parent DOM, the
  cookie and localStorage value the kit planted, a same-origin file with credentials, and the service worker API;
  whether `fetch()` and image requests get out; whether forms submit; which powerful Permissions Policy features are
  allowed; and whether it can navigate the top page (a fragment-only change the kit detects and cleans up). A button
  inside the frame repeats popups and top navigation after a real click, for the click-gated tokens.
- Every probe is harmless: reads only, nothing installed, requests only to the kit's own origin. Popups close at once.
- The kit only trusts messages whose `event.source` is its own frame and whose nonce matches the current run, and the
  report explains why `event.origin` can't be trusted for sandboxed frames.
- Graded report (escaped / open / blocked) with a fix for each leak, the iframe snippet for the current setup, a
  Markdown export and a share link that encodes the setup.
- "Test your own app": copy the probe as standalone HTML, render it in any preview feature and read its self-report.
- Out of scope: reproducing any real exploit chain, testing a live third-party app's message handlers, and a
  cross-origin preview host (the checklist recommends one).
