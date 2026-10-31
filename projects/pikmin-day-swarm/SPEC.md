# Pikmin Day Swarm: Tiny Browser Pikmin Task Sim

Idea #82 from the factory board (origin: automation, shortlisted by Dan).

## Pitch

A canvas toy where hundreds of colored dots follow your cursor, carry crumbs home, and pile up on an onion,
with a Nov 1 "Pikmin Day" countdown. Pikmin types get different behaviors, and you can write a one-line prompt
to make a new type.

## Why now

Nintendo surprise-aired a Pikmin Day Direct declaring November 1 as Pikmin Day. A small swarm-physics toy is easy
to ship in a weekend, and it fits the date.

## Scope for v0.1

- Canvas 2D lawn with an onion, puddles, and crumbs, berries, cookies, pellets and candy to carry (weights 1–20).
- Up to 650 sprouts with swarm following, separation, throwing, charging, whistling, carrying, and growth
  (leaf → bud → flower). Delivered items pop new sprouts of the majority carrier type and pile up on the onion.
- Five built-in types (red, yellow throws far, blue swims, purple carries like four, white is fast).
- "Invent a type": a deterministic one-line parser (color, fast/slow, strong/weak, swims, flies, tiny/big, glows,
  wanders, a count). No API key, so it's free to run and instant. Invented types ride along in the share link.
- Countdown to Nov 1 in local time, "Happy Pikmin Day!" on the day. Works with mouse, keyboard and touch.
- Fan-made, no Nintendo assets; everything is drawn in code.
