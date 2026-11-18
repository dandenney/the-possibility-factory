# AGENTS.md

`stock-yardage` is a static Vite + TypeScript app (Node 22.12+; runtime dependencies are only the two Fontsource
fonts). It lives in the factory repo but must not import from `apps/` or `packages/`; it has its own pnpm root and
lockfile.

## Commands (run from this directory)

- Install: `pnpm install`
- Dev: `pnpm dev` → http://localhost:5173
- Gate: `pnpm check` (typecheck, Vitest, Vite build). Run it before committing.
- Deploy: Netlify site `stock-yardage` builds from base directory `projects/stock-yardage` on every push to `main`
  that touches it.

## Layout

- `src/model.ts`: players, clubs (presets, `standardBag()`, dandenney.com `SITE_CLUBS` keys), venues, shots,
  `shortFor()`, `parseYards()`. No DOM.
- `src/stats.ts`: the last-5-good window, low/typical(median)/high, per-venue spreads and the gap to the course.
- `src/store.ts`: `localStorage` load/save under `stock-yardage:v1` and the import merge (dedupe by shot id).
- `src/exportfile.ts`: the export JSON (`format: "stock-yardage"`, `version: 1`) and its parser.
- `src/main.ts`: hash-routed UI (`#/card`, `#/log`, `#/club/<id>`, `#/bag`, `#/data`). `src/style.css`: the
  Ball Flight look (tokens match dandenney.com's `src/styles/golf.css`).
- `public/sw.js`: network-first service worker so the app opens offline. `public/og.png`: social preview rendered
  from the live site.

## Rules

- Local-only. No backend, analytics or network calls; data leaves the phone only through Export.
- Never reorder or rewrite stored shots; the card is derived. Bump `FORMAT_VERSION` and keep `parseExport` reading
  older files if the export shape changes, since dandenney.com's `yarn golf:yardages` reads it.
- Stats or export changes get a Vitest case.
- Commit convention: `feat(stock-yardage): ...` / `fix(stock-yardage): ...`.
