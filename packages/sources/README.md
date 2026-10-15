# @factory/sources

Automated collectors that turn external feeds into `signals` (phase 2).

Each collector implements `Collector` from `src/index.ts`, returns items with a stable
`externalId`, and is stored via `upsertSignals` in `@factory/core`, which skips duplicates.
