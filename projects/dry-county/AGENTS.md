# AGENTS.md

`dry-county` is a static Vite + TypeScript browser game (Node 22.12+, no runtime dependencies besides the
self-hosted Limelight and Barlow Semi Condensed fonts). It lives in the factory repo but must not import from
`apps/` or `packages/`; it has its own pnpm root and lockfile.

## Commands (run from this directory)

- Install: `pnpm install`
- Dev: `pnpm dev` → http://localhost:5173
- Gate: `pnpm check` (typecheck, Vitest, Vite build). Run it before committing.
- Deploy: Netlify site `dry-county` builds from this base directory on every push to `main` that touches it.

## Layout

- `src/sim.ts`: the still house (no DOM): inventory, barrels, still, creek hauls, the clock, events, saves.
  `advance` settles every event at its exact time, so big clock jumps match small steps.
- `src/scene.ts`: the isometric SVG room, drawn in code, and `updateScene` which mirrors state onto it.
- `src/main.ts`: panel, controls, clock loop, saving to `localStorage` (`dry-county:v1`).

## Rules

- One game hour is 3 real seconds (`MS_PER_GAME_HOUR`). Tune durations in `RULES`, not in the UI.
- Draw everything in code; no external art or game assets.
- Sim changes get a Vitest case in `src/sim.test.ts`.
- Bump the save key version if `State` changes shape.
- Commit convention: `feat(dry-county): ...` / `fix(dry-county): ...`.
