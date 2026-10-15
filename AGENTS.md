# AGENTS.md

Guidance for AI agents (Devin, Claude Code, etc.) working in this repo.

## What this is

The Possibility Factory: signals → ideas → built projects. See `README.md` for the roadmap.

## Stack

pnpm 11 workspaces + Turborepo · Astro 7 SSR on Netlify · Tailwind CSS v4 · Drizzle ORM on libSQL (local SQLite file in dev, Turso in production) · Vitest.

## Commands

- Install: `pnpm install` (Node 22.22+, see `.nvmrc`)
- Dev: `pnpm dev` → http://localhost:4321 (needs `apps/factory/.env`, copy from `.env.example`, then `pnpm db:migrate`)
- Gate: `pnpm check` runs typecheck (`astro check` / `tsc`), tests, and build. Run it before committing.

## Rules

- TypeScript everywhere. In `apps/factory`, import via the `@/` alias, not relative paths.
- Schema changes: edit `packages/core/src/schema.ts`, run `pnpm db:generate`, commit the generated SQL in `packages/core/migrations/`. Never edit applied migrations.
- All data access goes through functions in `packages/core/src/repo.ts`; pages don't build queries inline. Add a Vitest case in `repo.test.ts` for new repo functions.
- Pages use plain HTML forms that POST back to the page (no client JS framework). Keep it that way unless there's a clear need.
- Automated signals must set `source` (e.g. `rss:anthropic-news`) and a stable `externalId`, and be written with `upsertSignals` so reruns dedupe.
- `projects/*` are not workspace members. Each project is self-contained (own stack, lockfile, `AGENTS.md`) and must not import from `apps/` or `packages/`.
- pnpm enforces a minimum release age; don't add `minimumReleaseAgeExclude` entries to pull brand-new package versions.
- Never commit `.env` files or `*.db` files.

## Workflow

- Commit convention: `feat(scope): message` / `fix(scope): message` / `chore(scope): message`.
