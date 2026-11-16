# Product

<!-- impeccable:product-schema 1 -->

Init answers were filled in by Devin from SPEC.md and the factory board, not from a live interview. Items marked *(inferred)* have not been confirmed by Dan.

## Platform

web

## Users

- People who just watched or read about the Starship tower catch (from Hacker News, Bluesky or X) and want to try it for a minute on a phone or laptop. *(inferred)*
- Friends arriving from a shared replay GIF or challenge link who want to beat a score on the same flight. *(inferred)*

## Product Purpose

Let anyone feel how hard the tower catch is with one button, then share how it went. Success means a first-time visitor understands the controls from the page within one flight, catches the booster within a few tries, and shares a GIF or link.

## Positioning

A one-button arcade toy, not a simulator. The physics are simplified so a catch takes a few tries, not hours. Fan-made and unaffiliated with SpaceX.

## Operating Context

- Mostly phones in portrait from social links, plus desktop from Hacker News. *(inferred)*
- Replay GIFs and links travel through chat and social posts.

## Capabilities and Constraints

- Static Vite + TypeScript page on Netlify at https://chopsticks-catch.netlify.app. No backend, no analytics, no model calls.
- Seeded flights, 8 s of propellant, wind with gusts, scores out of 1,000, seven crash types.
- GIF replay is encoded in the browser; native share with the file when supported, otherwise download and copy link.
- Standalone project in the possibility-factory monorepo; must not import from `apps/` or `packages/`.

## Brand Commitments

- Name: Chopsticks Catch.
- Look: cool engineering-chart paper, ink line art, one flame-orange accent, Barlow. No SpaceX logos or photos.
- Voice: calm launch-control callouts, short and dry. *(inferred)*

## Evidence on Hand

- None beyond the factory signals. Do not invent player counts or quotes.

## Product Principles

- One button, always. Every state says what the button does next.
- The booster and the tower are the hero; the panel stays quiet.
- A crash should be fun to share, not just a catch.

## Accessibility & Inclusion

Fully playable with the keyboard (Space) and touch; results and callouts are announced via live regions; WCAG AA text contrast. *(inferred)*
