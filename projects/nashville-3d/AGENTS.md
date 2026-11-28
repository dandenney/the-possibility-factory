# AGENTS.md

`nashville-3d` is a static Vite + TypeScript page (Node 22.12+) with one runtime dependency, three.js. It lives in
the factory repo but must not import from `apps/` or `packages/`; it has its own pnpm root and lockfile.

## Commands (run from this directory)

- Install: `pnpm install`
- Dev: `pnpm dev` → http://localhost:5173
- Gate: `pnpm check` (typecheck, Vitest, Vite build). Run it before committing.
- Deploy: Netlify site `nashville-3d` builds from this base directory on every push to `main` that touches it.

## Layout

- `public/nashville.glb`: the whole model, exported from OpenGeoWorld and optimized. Frame: metres, X east, -Z north,
  origin at 36.1625, -86.7760 at ground level (see the GLB's root `extras`).
- `src/geo.ts`: lat/lon to model coordinates, the same flat projection as OpenGeoWorld's `makeProjection`.
- `src/view.ts`: camera framings (target, distance, heading, pitch), share-hash parse/format. No DOM.
- `src/landmarks.ts`: the landmark list (OSM/Nominatim positions, note, default framing).
- `src/main.ts`: three.js scene, controls, flights, pins, tour, share. `public/og.png`: social preview from the live site.

## Rebuilding the model

1. Clone https://github.com/perezjoan/opengeoworld, `pnpm install`, `WORLD_AUTOSTART=0 pnpm dev` (port 8765).
2. Force NAIP imagery: in `apps/web/src/data.js` set `AUTO_ORDER = ['naip']` and cap the image request at 4000 px
   (`Math.min(4000, MAX_TEX, ...)`); the NAIP server rejects 4096. Keep the baked imagery public domain (NAIP), not Esri's.
3. Pick 36.1625, -86.7760, radius 1000 m, build, wait for the street trees to come in, download the GLB.
4. `npx gltf-transform optimize in.glb public/nashville.glb --compress meshopt --texture-compress webp --texture-size 4096 --simplify false`
   (about 55 MB in, 14 MB out). If the origin or radius changes, update `src/geo.ts`.

## Rules

- No data API calls, analytics or hosted model calls from the page; everything is in the GLB.
- Keep the attribution in the page's credits (OpenStreetMap ODbL, USGS, OpenGeoWorld MIT).
- Changes to `geo.ts` or `view.ts` get a Vitest case in `src/view.test.ts`.
- Commit convention: `feat(nashville): ...` / `fix(nashville): ...`.
