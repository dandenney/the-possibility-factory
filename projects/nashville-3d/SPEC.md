# Nashville in 3D: Downtown Built from Open Data

Idea #197 from the factory board (origin: manual, shortlisted by Dan).

## Pitch

Downtown Nashville as a 3D model you can spin in the browser: lidar terrain, an aerial photo and OpenStreetMap
buildings, baked with OpenGeoWorld. Fly to the Ryman, Broadway, the Batman Building or Nissan Stadium, take a short
tour, and share a link to the exact view.

## Why now

OpenGeoWorld, an open-source tool that builds a 3D city model of any place from open data right in the browser, has
been doing the rounds on LinkedIn. Dan spotted it and wanted a Nashville one.

## Sparked by

- [OpenGeoWorld on GitHub](https://github.com/perezjoan/opengeoworld) by [Urban Geo Analytics](https://urbangeoanalytics.com)

## Scope for v0.1

- One fixed place: a 1 km radius around 36.1625, -86.7760 (the Batman Building), generated once with OpenGeoWorld
  and shipped as a single 14 MB GLB (meshopt geometry, WebP textures). The page makes no data API calls.
- Data: USGS 3DEP lidar terrain, USGS NAIP 60 cm aerial photo (public domain, picked over Esri imagery so the baked
  file can be hosted), OpenStreetMap buildings, roads, water and trees (ODbL, credited on the page).
- Static Vite + TypeScript page with three.js: map-style controls (drag, rotate, pinch or scroll to zoom).
- 13 landmarks with pins in the scene and a list in the panel. Picking one flies the camera there and shows a
  one-line note; the framing backs off on tall phone screens and climbs over buildings in the way.
- "Take the tour" visits each landmark in turn until the visitor touches the map.
- Share links: `#ryman` for a landmark, `#@x,z,dist,heading,pitch` for any view. Native share on phones,
  clipboard elsewhere.
- Light paper panel (side card on desktop, bottom sheet on phones), one red accent, og:image.
