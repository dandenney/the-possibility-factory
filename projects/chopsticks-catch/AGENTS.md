# AGENTS.md

`chopsticks-catch` is a static Vite + TypeScript canvas game (Node 22.12+, no runtime dependencies besides the
Barlow fonts). It lives in the factory repo but must not import from `apps/` or `packages/`; it has its own pnpm
root and lockfile.

## Commands (run from this directory)

- Install: `pnpm install`
- Dev: `pnpm dev` → http://localhost:5173
- Gate: `pnpm check` (typecheck, Vitest, Vite build). Run it before committing.
- Deploy: Netlify site `chopsticks-catch` builds from this base directory on every push to `main` that touches it.

## Layout

- `src/sim.ts`: the flight (no DOM): seeded wind and start, thrust, fuel, catch window, arms, outcomes and score.
  `autopilot` is a test pilot that shows almost every seed is catchable.
- `src/gif.ts`: GIF89a + LZW encoder and palette quantizer. `src/replay.ts`: records frames and builds the GIF.
- `src/callouts.ts`: launch-control lines. `src/share.ts`: challenge links and share text.
- `src/draw.ts`: all Canvas 2D drawing. `src/main.ts`: input, HUD, loop, result and sharing.

## Rules

- Keep it dependency-free at runtime, no hosted model calls, and no SpaceX assets (draw everything in code).
- Sim, encoder and share changes get a Vitest case. Retune physics against the autopilot catch-rate test.
- Commit convention: `feat(chopsticks-catch): ...` / `fix(chopsticks-catch): ...`.
