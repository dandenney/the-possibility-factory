# AGENTS.md

`pelican-bench-arena` is a static Vite + TypeScript page plus two Netlify Functions (Node 22.18+). It lives in the
factory repo but must not import from `apps/` or `packages/`; it has its own pnpm root and lockfile.

## Commands (run from this directory)

- Install: `pnpm install`
- Dev (page only): `pnpm dev` → http://localhost:5173. Voting falls back to the "Just you" board.
- Dev with functions + local Blobs: `npx netlify-cli dev --offline --functions "$PWD/netlify/functions"` →
  http://localhost:8888. Pass the functions path explicitly; run from a monorepo subdirectory, the CLI otherwise
  resolves it from the repo root and serves no functions.
- Gate: `pnpm check` (typecheck, Vitest, Vite build). Run it before committing.
- Generate pelicans: `OPENROUTER_API_KEY=... pnpm generate [slug ...] [--redo]`. It only fills missing samples,
  stops on a 402 (out of credits), and records non-billing failures in `src/gallery.json`. Or run the
  "Pelican Bench Arena SVGs" workflow (repo secret `OPENROUTER_API_KEY`), which commits the results.
- Deploy: Netlify site `pelican-bench-arena` builds from this base directory on every push to `main` that touches it.

## Layout

- `models.json`: the prompt, samples per model, and the model list (`slug` is the stable id used in votes;
  `id` is the OpenRouter model id; `featured` marks this week's releases).
- `scripts/generate.ts`: OpenRouter calls. `src/svg.ts`: extract and sanitize model SVGs.
- `src/gallery.json` + `public/svgs/<slug>/<n>.svg`: generated output, committed.
- `src/ranking.ts`: vote keys and the Bradley-Terry fit. `src/matchup.ts`: picking pairs. `src/main.ts`: UI.
- `src/store.ts` (server only) + `netlify/functions/{vote,leaderboard}.mts`: `POST /api/vote`, `GET /api/leaderboard`.
  Each vote is an empty blob in store `votes` whose key encodes `a_b_outcome`, so ranking only lists keys.

## Rules

- Never call a model from the page or a function; generation stays offline so the key never ships.
- SVGs are shown via `<img>` and sanitized at generation; `/svgs/*` also gets a no-script CSP in `netlify.toml`.
- Don't rename a model `slug` once it has votes (votes reference it). Slugs are `[a-z0-9.-]` only.
- Ranking/sanitizing changes get a Vitest case next to the code.
- Commit convention: `feat(pelican-bench): ...` / `fix(pelican-bench): ...`.
