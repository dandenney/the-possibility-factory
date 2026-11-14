<!-- exact:begin (exact new writes this block; bun exact.mjs update rewrites it) -->
# electron-diet: an Exact app

`app.contract` is the view, `app.ts` the data module, `app.test.contract` the tests, `app.json`
the manifest: set `app.name` and `app.id` before building. The app uses Exact at
`../../exact` by path (`EXACT` overrides it).

This file is already in your instructions. Start from the nearest pattern: `bun exact.mjs
pattern` lists them and `pattern <name>` writes one, tested. ../../exact/docs/start-here-site.md (a site) or
../../exact/docs/start-here.md is the only required reading. `bun exact.mjs contract vocab <name>` answers a
name (none: the card); `bun exact.mjs docs <heading words>` a guide's
section. Run `bun exact.mjs verify` when the features work, and `verify ios|android` at the end for a
phone app. When an iPhone app is ready to try, run `bun exact.mjs share` and send its link;
repeat for each change the person should see. `bun exact.mjs help` lists the verbs, including
app.json's `"commands"`.
`bun exact.mjs update` refreshes files. Native verbs (`ios`, `mac`, `linux`, `android`, `windows`)
name their platform in app.json on first use and build in a generated workspace;
`update --without <platform>` stops shipping it.
`bun ../../exact/scripts/exact.mjs setup --check` names what a native build lacks.

Generated, so don't edit: `exact.mjs` and this block.

## Feedback (required)

When a doc was wrong or missing, a workaround was needed, something took several tries or a
command confused you, record it: `bun exact.mjs feedback note "<what happened>"`. It attaches
exact2's commit and the last exit code, never output or code. `bun exact.mjs feedback status` says
whether notes are sent and whether to keep a diary; under `never`, skip all of this.
<!-- exact:end -->

## This project

`electron-diet` is idea #123 of the factory, built with [Exact](https://github.com/expo/exact) (pre-alpha) as a
test of it: a web page and a native Mac app from one Contract. It lives in the factory repo but must not import
from `apps/` or `packages/`. Exact is used by path: clone `expo/exact` and set `EXACT=<checkout>` (or put it at
`../../exact`), then run `bun <checkout>/scripts/exact.mjs setup` once. Built and tested against Exact commit
`b3d542bed3d6d0f8460d5379ede668720246b468`; Exact changes daily, so a newer checkout may need fixes.

- Gate: `bun run check` (Contract build, `bun test` for `diet.ts`, then `test web` in headless Chrome).
- Web dev loop: `bun exact.mjs web`. Mac app: `bun exact.mjs mac --run` (on a Mac with Xcode; `setup --check --platform macos` names what's missing).
- Deploy: Netlify site `electron-diet`, base directory `projects/electron-diet`, publishes the committed `site/`
  with no build step. After a change, run `bun run build:site` (Exact builds only into `dist/`, so it copies `dist/` to `site/`) and commit `site/` with it.

### Layout

- `diet.ts`: parsing (`ps`, `ps aux`, `tasklist` table and CSV), grouping by app, classification lists, the 70%
  saving and the report. No host code; tested by `diet.test.ts`.
- `app.contract`: the one screen. `app.ts`: its sources (`analyze`, `sample`, `scanner`, `scanMac`). `sample.ts`: the sample Mac.
- `modules/apple/ProcessScan.swift`: the Mac app's `native.later`, which lists processes through libproc and names
  bundles containing `Electron Framework.framework`. The web has no module, so `scanner` reports it unavailable there.
- `site/`: the committed web build. `public/og.png` is copied into it by `build:site`.

### Rules

- Nothing leaves the device: no fetch grants, no analytics.
- Classification changes get a case in `diet.test.ts`; UI changes keep `app.test.contract` passing.
- Commit convention: `feat(electron-diet): ...` / `fix(electron-diet): ...`.
