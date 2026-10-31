# AGENTS.md

`pikmin-day-swarm` is a static Vite + TypeScript canvas toy (Node 22.12+, no runtime dependencies). It lives in the
factory repo but must not import from `apps/` or `packages/`; it has its own pnpm root and lockfile.

## Commands (run from this directory)

- Install: `pnpm install`
- Dev: `pnpm dev` → http://localhost:5173
- Gate: `pnpm check` (typecheck, Vitest, Vite build). Run it before committing.
- Deploy: Netlify site `pikmin-day-swarm` builds from this base directory on every push to `main` that touches it.

## Layout

- `src/sim.ts`: the world (no DOM): sprouts, items, puddles, onion, carrying, deliveries. Seeded PRNG for tests.
- `src/types.ts`: built-in types, the one-line `inventType` parser, share-link encoding.
- `src/draw.ts`: all Canvas 2D drawing. `src/main.ts`: input, HUD, loop. `src/countdown.ts`: Nov 1 countdown.

## Rules

- Keep zero runtime dependencies and no Nintendo assets (draw everything in code).
- Sim and parser changes get a Vitest case.
- Commit convention: `feat(pikmin-day): ...` / `fix(pikmin-day): ...`.
