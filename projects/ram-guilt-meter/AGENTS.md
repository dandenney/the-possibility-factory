# AGENTS.md

`ram-guilt-meter` is a static Vite + TypeScript page (Node 22.12+, no runtime dependencies). It lives in the factory
repo but must not import from `apps/` or `packages/`; it has its own pnpm root and lockfile.

## Commands (run from this directory)

- Install: `pnpm install`
- Dev: `pnpm dev` → http://localhost:5173
- Gate: `pnpm check` (typecheck, Vitest, Vite build). Run it before committing.
- Deploy: Netlify site `ram-guilt-meter` builds from this base directory on every push to `main` that touches it.

## Layout

- `src/guilt.ts`: all the math (no DOM): hoarded GB, KV-cache tokens, score, tiers and quips, share-link encoding.
- `src/probe.ts`: browser memory APIs. `src/card.ts`: the 1200×630 canvas guilt card. `src/main.ts`: UI wiring.
- `public/og.png`: social preview, a screenshot of the card for 47 typical tabs on 16 GB.

## Rules

- Keep zero runtime dependencies and nothing sent off the device.
- The site is served with COOP/COEP (see `netlify.toml` and `vite.config.ts`) so
  `measureUserAgentSpecificMemory()` works; any cross-origin asset must send CORP headers or it will be blocked.
- Math changes get a Vitest case in `src/guilt.test.ts`.
- Commit convention: `feat(ram-guilt): ...` / `fix(ram-guilt): ...`.
