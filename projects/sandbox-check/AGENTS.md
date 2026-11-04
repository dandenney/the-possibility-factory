# AGENTS.md

`sandbox-check` is a static Vite + TypeScript page (Node 22.12+, no runtime dependencies). It lives in the factory
repo but must not import from `apps/` or `packages/`; it has its own pnpm root and lockfile.

## Commands (run from this directory)

- Install: `pnpm install`
- Dev: `pnpm dev` → http://localhost:5173
- Gate: `pnpm check` (typecheck, Vitest, Vite build). Run it before committing.
- Deploy: Netlify site `sandbox-check` builds from this base directory on every push to `main` that touches it.

## Layout

- `src/payload.ts`: `probeMain`, the probe that runs inside the frame. It is stringified into the framed HTML, so it
  must stay self-contained (no imports, no outside helpers). Check it in a real browser after a production build
  (`pnpm build && pnpm preview`), since minification is what ships.
- `src/config.ts`: embed methods, sandbox tokens, CSP presets, presets, the framed document, the iframe snippet and
  share-link encoding. No DOM.
- `src/verdict.ts`: turns probe facts into graded findings, the summary and the Markdown report. No DOM.
- `src/main.ts`: UI wiring, running the frame, the message listener and the top-navigation hash check.
- `public/canary.txt` (read-API probe), `public/dot.png` (egress probes), `public/og.png` (social card).

## Rules

- Probes stay harmless: read, never write; install nothing (the service worker probe only lists registrations);
  request only the kit's own origin; close any popup at once; never trigger `alert`/`confirm`/`prompt`. This tool
  tests configurations, it doesn't ship exploit chains.
- Don't add a Content-Security-Policy header to the kit (`netlify.toml`, `vite.config.ts`): `srcdoc` and blob frames
  inherit it and the probes would report the kit's policy instead of the chosen setup.
- Don't name probe assets like trackers (`pixel.gif`, `beacon`, `track`): content blockers drop those requests and
  egress then reads as blocked.
- The message listener must keep checking `event.source === frame.contentWindow` and the run's nonce.
- Verdict or config changes get a Vitest case in `src/verdict.test.ts` or `src/config.test.ts`.
- Commit convention: `feat(sandbox-check): ...` / `fix(sandbox-check): ...`.
