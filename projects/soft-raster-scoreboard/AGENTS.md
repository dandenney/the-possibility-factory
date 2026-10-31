# AGENTS.md

`soft-raster-scoreboard` is a static Vite + TypeScript site (Node 22.12+, no runtime dependencies). It lives in
the factory repo but must not import from `apps/` or `packages/`; it has its own pnpm root
(`pnpm-workspace.yaml`) and lockfile.

## Commands (run from this directory)

- Install: `pnpm install`
- Dev: `pnpm dev` → http://localhost:5173 (data comes live from ESPN; no keys needed)
- Gate: `pnpm check` (typecheck, Vitest, Vite build). Run it before committing.
- Deploy: Netlify site `soft-raster-scoreboard` builds from this base directory on every push to `main`
  that touches it (`netlify.toml`).

## Layout

- `src/math.ts`, `src/raster.ts`: the software renderer. Keep it GPU-free: no WebGL, no WebGPU, no
  CSS 3D transforms for the scene. Canvas 2D is only used for `putImageData` and to paint the field texture once.
- `src/meshes.ts`, `src/field.ts`, `src/scene.ts`: geometry, field texture + heatmap, the per-frame scene.
- `src/espn.ts`: ESPN parsing. World x is yards from the home goal line (0) to the away goal line (100).
- `src/replay.ts`: ball paths per play; `src/bets.ts`: bet parsing and grading; `src/featured.ts`: pinned bets.
- `src/main.ts`: DOM wiring, playback, polling.

## Rules

- Keep zero runtime dependencies.
- New parsing or replay behavior gets a Vitest case; ESPN fixtures live in `src/fixtures/` (trim them).
- Commit convention: `feat(soft-raster): ...` / `fix(soft-raster): ...`.
