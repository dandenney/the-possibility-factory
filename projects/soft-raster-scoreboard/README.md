# Soft-Raster Scoreboard

College football replays drawn by a software rasterizer. Every pixel is computed in JavaScript into a
`Uint32Array`, with no GPU, WebGL, or WebGPU, then pushed to a canvas with `putImageData`.

Live: https://soft-raster-scoreboard.netlify.app

- Pick any FBS game for a date (live games refresh every 20 s, and **Live** follows new plays).
- Watch each play: runs, drop-backs and throws, kicks and returns, field goals, with the line of scrimmage
  and line to gain drawn on the field.
- The field fills in with a heatmap of where each team's runs and passes ended.
- Add `?bet=IOWA ML` or `?bet=WASH +7.5` to see whether a bet is covering as the replay plays.

The renderer (`src/raster.ts`) does perspective-correct textured triangles, a z-buffer, near-plane clipping,
depth-tested lines, and multiply-blended shadows. The stats in the corner show milliseconds per frame,
triangles, and pixels filled.

Data: ESPN's public site API. Ball paths are inferred from play-by-play text, so they're approximate.
