# AGENTS.md

`diffrails` is a standalone TypeScript CLI (Node 22.12+, no runtime dependencies). It lives in the factory
repo but must not import from `apps/` or `packages/`; it has its own pnpm root (`pnpm-workspace.yaml`) and lockfile.

## Commands (run from this directory)

- Install: `pnpm install`
- Run from source: `node src/cli.ts <command>` (Node strips the types; imports use `.ts` extensions)
- Gate: `pnpm check` (typecheck, Vitest, build to `dist/`). Run it before committing.
- Publish: `pnpm publish` (runs the build via `prepack`; needs npm credentials)

## Layout

- `src/cli.ts`: argument parsing and commands
- `src/diff.ts`: unified diff parser; `src/glob.ts`: glob matching; `src/rules.ts`: rule evaluation
- `src/config.ts`: `.diffrails.json` types, validation, starter rules
- `src/init.ts`: instruction-file discovery and the Claude call (plain `fetch`, no SDK)
- `src/hook.ts`: pre-commit hook install/uninstall; `src/replay.ts`: history replay
- `examples/`: configs generated for real repos

## Rules

- Keep zero runtime dependencies; use Node built-ins.
- Every git call goes through `git()` in `src/git.ts`. Diff commands use `DIFF_FLAGS` so user git config
  (colors, external diff tools, `noprefix`) can't change the output.
- New behavior gets a Vitest case. CLI behavior is tested end to end against temp repos (`src/cli.test.ts`).
- Commit convention: `feat(diffrails): ...` / `fix(diffrails): ...`.
