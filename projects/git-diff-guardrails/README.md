# diffrails

Instruction files drift; hooks don't. `diffrails` reads the conventions in your `AGENTS.md` / `CLAUDE.md`,
turns the ones a diff can show into rules, and checks every commit against them, whether a person or a
coding agent wrote it.

```console
$ export ANTHROPIC_API_KEY=...
$ npx diffrails init        # AGENTS.md, CLAUDE.md → .diffrails.json
$ npx diffrails replay      # how often would these rules have fired recently?
$ npx diffrails install     # git pre-commit hook
$ git commit -m "feat: add page"
apps/factory/src/pages/new.astro
    3  error  In apps/factory, import via the `@/` alias instead of relative paths.  factory-no-relative-imports
       │ import Layout from "../layouts/Layout.astro";

diffrails: 1 error
Fix the issues, or bypass once with `git commit --no-verify`.
```

Requires Node 22.12+ and git. No runtime dependencies.

## Commands

| Command | What it does |
| --- | --- |
| `diffrails init [--from FILE...] [--model ID] [--print] [--force]` | Find `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `.cursorrules`, `.windsurfrules`, `.github/copilot-instructions.md`, and nested `AGENTS.md`/`CLAUDE.md`; ask Claude to write `.diffrails.json`. Prints the conventions it couldn't turn into checks. Without `ANTHROPIC_API_KEY` it writes starter rules. |
| `diffrails check` | Check the staged diff. Exits 1 if any `error` rule fires. |
| `diffrails check --base origin/main [--head REF]` | Check the changes on HEAD since it left `origin/main` (use in CI). |
| `diffrails install [--force]` / `uninstall` | Add or remove a `pre-commit` hook. Respects `core.hooksPath`; won't replace a hook it didn't write unless `--force`. |
| `diffrails replay [-n 50] [--agents] [--agent-pattern REGEX] [--rev REV]` | Run the current rules over recent commits and rank the most-violated rules. `--agents` keeps only commits whose author or `Co-authored-by` trailer is a coding agent (Devin, Claude, Codex, Copilot, Cursor, Aider, Gemini, ...). |

`check` and `replay` accept `--json` and `--config FILE`. `DIFFRAILS_MODEL` (default `claude-sonnet-5-5`)
and `ANTHROPIC_BASE_URL` configure `init`.

## Rules

`.diffrails.json` is meant to be read and edited by hand. Three rule types:

```jsonc
{
  "version": 1,
  "ignore": ["src/generated/**"],
  "rules": [
    {
      // Regex tested against each added line.
      "id": "use-diagnostics",
      "type": "line",
      "pattern": "console\\.(log|warn|error)\\(",
      "paths": ["src/**"],
      "exclude": ["src/lib/diagnostics.ts"],
      "message": "Log through src/lib/diagnostics.ts so errors reach Sentry.",
      "source": "AGENTS.md: All logging goes through the diagnostics module."
    },
    {
      // Files that must not be added (default), modified, deleted, or renamed.
      "id": "no-edit-applied-migrations",
      "type": "file",
      "paths": ["db/migrations/*.sql"],
      "on": ["modified", "deleted", "renamed"],
      "message": "Never edit applied migrations; generate a new one."
    },
    {
      // If a file in `paths` changes, a file in `require` must change in the same commit.
      "id": "schema-needs-migration",
      "type": "cochange",
      "paths": ["db/schema.ts"],
      "require": ["db/migrations/**"],
      "severity": "warn",
      "message": "Run db:generate and commit the migration."
    }
  ]
}
```

- `severity` is `error` (default, blocks the commit) or `warn`.
- Globs support `**`, `*`, `?`, `{a,b}`, `[...]`. A glob without `/` matches at any depth (`*.db`).
- Add `diffrails-ignore` (all rules) or `diffrails-ignore: rule-a, rule-b` in a comment to silence one line.
- `.diffrails.json` itself is never checked.

## Tuning with replay

`replay` is the fastest way to check generated rules before turning on the hook: a rule that fires on most
commits is probably too broad. On this repo, the first generated config flagged `packages/core/migrations/**`
for edits, which also caught drizzle's `meta/_journal.json` (updated on every `db:generate`). Narrowing the
glob to `*.sql` fixed it; see [`examples/the-possibility-factory/.diffrails.json`](examples/the-possibility-factory/.diffrails.json).

## Using it with other hook managers and CI

- husky / lefthook / pre-commit: run `diffrails check` as a pre-commit command instead of `diffrails install`.
- GitHub Actions:

  ```yaml
  - uses: actions/checkout@v4
    with: { fetch-depth: 0 }
  - run: npx diffrails check --base origin/${{ github.base_ref }}
  ```

## Development

See [AGENTS.md](AGENTS.md).
