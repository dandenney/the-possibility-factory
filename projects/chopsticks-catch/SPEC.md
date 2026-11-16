# Chopsticks Catch: One-Button Starship Tower Landing Game

Idea #158 from the factory board (origin: automation, shortlisted by Dan).

## Pitch

A tiny canvas or WebGL arcade game where you throttle the Starship booster and time the tower arms to catch it.
It has wind, fuel and a shareable replay GIF of your catch or crash. A stretch goal is an LLM commentator who
narrates like launch control.

## Why now

SpaceX catching the Flight 15 upper stage is a huge story, with 1,494 points on HN and a lot of Bluesky chatter.
People want to try the catch themselves.

Sparked by:

- https://www.spacex.com/launches/starship-flight-15
- https://news.ycombinator.com/item?id=50500963
- https://bsky.app/profile/did:plc:qrz3lhbyuxbeilrc6nekdqme/feed/c541771d2b50

## Scope for v0.1

- Canvas 2D side view: a booster falls from 480 m toward a tower whose two chopstick arms sit at 100 m.
- One button (Space, mouse or touch). Hold to burn: the engines slow the fall and steer back toward the arms
  against the wind. Let go while the catch pins are inside the 8 m catch window and the arms close in 0.45 s.
- 8 s of propellant. Wind is a steady push plus two gusts. Every flight number (seed) gives the same start and
  wind, so a shared link replays the same conditions.
- Outcomes: perfect, clean or rough catch scored out of 1,000 on speed and centering, or one of seven crashes
  (too hot, slipped through, closed on air, missed, hit the tower, hit the launch mount, hit the ground).
- Launch-control commentary from a handwritten line bank instead of an LLM, so the site never calls a model.
- Replay GIF of the last 7 s plus a result card, encoded in the browser by a small GIF89a encoder (no
  dependencies). Native share sheet with the GIF where supported, otherwise download plus a copied link.
- Challenge links (`?f=<flight>&s=<score>`) and a per-flight best score in localStorage.
- Fan-made, not affiliated with SpaceX; everything is drawn in code.
