# AGENTS.md

`deslop-detector` is a static Vite + TypeScript page (Node 22.12+, no runtime dependencies). It lives in the factory
repo but must not import from `apps/` or `packages/`; it has its own pnpm root and lockfile.

## Commands (run from this directory)

- Install: `pnpm install`
- Dev: `pnpm dev` → http://localhost:5173
- Gate: `pnpm check` (typecheck, Vitest, Vite build). Run it before committing.
- Deploy: Netlify site `deslop-detector` builds from this base directory on every push to `main` that touches it.
- Local rewrite testing: `ollama pull hf.co/erikkannike/qwen3-4b-deslop-v4-GGUF:Q4_K_M`, then
  `OLLAMA_ORIGINS=http://localhost:5173 ollama serve`. On a CPU-only VM it does about 1–2 tokens/s, so test with
  one short paragraph.

## Layout

- `src/detect.ts`: rules, weights, sentence splitter, score and tiers, `segments()` for drawing overlapping marks.
  No DOM.
- `src/share.ts`: score links (`?s=&w=&c=`) and the compressed text fragment (`#t=`).
- `src/rewrite.ts`: Ollama client (`/api/tags`, streaming `/api/chat`), the rewrite prompt, paragraph splicing.
- `src/card.ts`: the 1200×630 canvas score card. `src/samples.ts`: the "Try" texts. `src/main.ts`: UI wiring.
- `public/og.png`: social preview, the card for the chatbot blog sample rendered from the live site.

## Rules

- Keep zero runtime dependencies. Text only leaves the tab when the visitor shares it or sends it to their own
  Ollama; never add analytics or a hosted model call.
- The textarea sits on a backdrop that draws the marks; both must keep identical font, padding and wrapping.
- Rule or weight changes get a Vitest case in `src/detect.test.ts`. Keep the score on the per-1000-words scale
  (people under 15, chatbots about 120) and keep the samples test passing.
- Commit convention: `feat(deslop): ...` / `fix(deslop): ...`.
