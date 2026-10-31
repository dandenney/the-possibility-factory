# Software-Rendered Scoreboard: Soft-Raster Football Match Replays

Idea #15 from the factory board (origin: automation, shortlisted by Dan).

## Pitch

A tiny CPU-only software rasterizer in JS or WASM that turns match stats (xG, shots, possession) from a
Premier League or college football game into a stylized 3D replay, with no GPU or WebGL. Pick a game and
watch the heatmap.

## Why now

'I love software rendering' is resonating on HN, and football match searches are huge this weekend
(Everton–Chelsea, BYU–Notre Dame, Man City, Liverpool). That makes it easy to demo with real data.

## Scope for v0.1

- College football only (FBS), using ESPN's public scoreboard + summary endpoints straight from the browser.
- A from-scratch rasterizer in TypeScript: perspective-correct textured triangles, z-buffer, near-plane
  clipping, depth-tested lines, multiply-blended shadows. Output is a `Uint32Array` pushed with `putImageData`.
- Scene: painted field (yard lines, numbers, end zones in team colors), grandstand, goalposts, a lit football,
  line of scrimmage and line to gain.
- Replay every play in order with a ball path inferred from the play-by-play (runs, drops and throws, kicks
  and returns, field goals). Heatmap of where each team's runs and passes ended, weighted by yards gained.
- Broadcast scorebug, play ticker, win-probability strip (click to seek), three cameras, four resolutions.
- Live games refresh every 20 seconds; "Live" follows new plays as they arrive.
- Optional bet tracking (`?bet=IOWA ML`, `?bet=WASH +7.5`) shows whether the bet is covering as the replay
  plays. Dan and GardenOf's bets for the day are pinned in `src/featured.ts`.

## Out of scope for v0.1

- Soccer (ESPN soccer feeds have no field positions per event), WASM, player models.
