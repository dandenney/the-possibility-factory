# The Possibility Factory

An idea factory and a software factory. It collects **signals** (AI model releases,
engineering tooling releases, pop culture, personal interests), turns them into **ideas**,
and eventually builds the best ones as projects in this repo.

## Roadmap

1. **Manual capture** (done): log signals by hand or with a bookmarklet, turn them into ideas, triage on a board.
2. **Automation**: scheduled collectors in `packages/sources` plus LLM idea generation.
3. **Execution**: an approved idea gets a `projects/<slug>/SPEC.md` and a Devin session that builds it and opens a PR.

## Layout

```
apps/factory/      Astro (SSR) app on Netlify: board, signals, ideas
packages/core/     Drizzle schema, migrations, data access (libSQL / Turso)
packages/sources/  Collectors that turn feeds into signals (phase 2)
projects/<slug>/   Built projects, each with its own stack (see projects/README.md)
```

## Getting started

Requires Node 22.22+ (see `.nvmrc`) and pnpm 11 (`corepack enable`).

```sh
pnpm install
cp apps/factory/.env.example apps/factory/.env
pnpm db:migrate        # creates ./local.db
pnpm dev               # http://localhost:4321
```

## Commands

| Command            | What it does                                    |
| ------------------ | ----------------------------------------------- |
| `pnpm dev`         | Run the factory app                             |
| `pnpm check`       | Typecheck, test, and build everything (the CI gate) |
| `pnpm db:generate` | Generate a migration after editing `packages/core/src/schema.ts` |
| `pnpm db:migrate`  | Apply migrations to `DATABASE_URL`              |
| `pnpm db:studio`   | Browse the database in Drizzle Studio           |

## Deploying

Netlify site with **Package directory** `apps/factory` (config in `apps/factory/netlify.toml`).
Environment variables:

- `DATABASE_URL`: `libsql://<db>-<org>.turso.io`
- `DATABASE_AUTH_TOKEN`: Turso token
- `FACTORY_PASSWORD`: login password (required in production)
- `SESSION_SECRET`: random string used to sign the session cookie

Apply migrations to Turso with `DATABASE_URL=... DATABASE_AUTH_TOKEN=... pnpm db:migrate`.
