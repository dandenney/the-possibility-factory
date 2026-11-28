# Product

<!-- impeccable:product-schema 1 -->

Init answers were filled in by Devin from SPEC.md and Dan's request, not from a live interview. Items marked *(inferred)* have not been confirmed by Dan.

## Platform

web

## Users

- Nashvillians and visitors who see a shared link on LinkedIn or in a group chat and want to poke at downtown: find their office, the Ryman, the stadium. *(inferred)*
- People curious about open geodata and OpenGeoWorld who want to see what it produces for a real city. *(inferred)*

## Product Purpose

Let anyone explore downtown Nashville in 3D in a few seconds, with no install or account, and share a specific view. Success means the model loads, the visitor flies to a landmark they know, and sends someone a link. *(inferred)*

## Positioning

A small, fixed, polished showcase of one city rather than a general city builder: the model is baked ahead of time so it loads fast and needs no data services, and the landmarks give it a Nashville voice.

## Operating Context

- Mostly opened on phones from a shared link; the panel becomes a bottom sheet and the model is the page.
- Desktop visitors use mouse drag, right-drag and scroll.
- The 14 MB model is the main download; the loading screen shows progress.

## Capabilities and Constraints

- Static Vite + TypeScript + three.js page, deployed to Netlify at https://nashville-3d.netlify.app.
- One GLB built with OpenGeoWorld: USGS lidar terrain, NAIP aerial photo, OSM buildings, roads, water, trees.
- 13 landmarks, a tour, share links by landmark id or exact view.
- No analytics, no data APIs, no hosted model calls.

## Brand Commitments

- Light paper panel, one accent (honky-tonk neon red, `#c2412d`), thin rules, a serif display face. The model supplies the colour; the chrome stays quiet.
- Plain, friendly copy that sounds like a local giving directions, not marketing. *(inferred)*
- Credit the data sources honestly, including what is guessed (heights, generic facades).

## Anti-patterns

- Dark, many-colour "GIS dashboard" chrome; layer toggles and coordinate readouts.
- Copy that oversells the model as photo-real.
