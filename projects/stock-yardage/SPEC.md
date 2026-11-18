# Stock Yardage: How Far You Actually Hit Each Club

Idea #166 from the factory board (origin: manual, shortlisted by Dan).

## Pitch

Log good shots by club, on and off a tee, at GOLFTEC, Topgolf, the range and the course. Keep a card of the last
five good ones per club, see which venue reads long, and export it to dandenney.com/golf.

## Why now

Dan and Misty practice at GOLFTEC, Topgolf and on real courses, and the launch monitor, the Toptracer estimate and
the posted range signs all disagree. They want their own five-good-shot ranges per club, tee and no tee, to know
what to pull on the course. Misty's set is unusual, so each player edits their own bag.

## Sparked by

- [Ball Flight on dandenney.com](https://dandenney.com/golf)

## Scope for v0.1

- Static Vite + TypeScript, local-only: everything lives in `localStorage` on the phone. No backend, no analytics.
- Two players (Dan, Misty), each with their own bag. It starts from a standard set; add a preset or any named club
  (7 Wood, 4 Hybrid, 52° Wedge), rename it, change its short code, reorder, remove. Removing keeps its shots.
- Log a shot: venue (GOLFTEC, Topgolf, range, course), club, tee or no tee, carry and optional total, then "Good
  shot" or "Mishit". Mishits stay in history but never count. Undo from the toast.
- The card: every club in bag order with a low–high bar and typical (median) for the last 5 good shots, tee and no
  tee on separate lines, carry or total.
- Club page: both readouts, each venue's last 5 against the course ("Topgolf reads +11"), and every shot with
  mark good / mishit / delete.
- Export a JSON file (download, share or copy) with the card and raw shots, clubs mapped to dandenney.com's club
  keys. Import merges another phone's file by shot id, so importing twice is safe.
- Ball Flight's dark look from dandenney.com/golf (Dan's call), mobile-first, installable, works offline.
