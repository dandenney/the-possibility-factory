# Git-Diff Guardrails: Pre-commit Hooks for Agents

Idea #4 from the factory board (origin: automation, shortlisted by Dan).

## Pitch

A CLI that reads your AGENTS.md or CLAUDE.md conventions and generates pre-commit hooks that inspect the
git diff, for example flagging direct calls that should go through your diagnostics library. It can also
replay recent agent commits to show which rules got violated most.

## Why now

Geoffrey Huntley argues that hooks beat instruction files, which drift. Claude Code and Codex are shipping
new releases, and Anthropic is rebuilding source control around the surge in agent-written changes.

## Scope for v0.1

- `diffrails init`: find AGENTS.md / CLAUDE.md / Copilot / Cursor instruction files (root and nested), ask
  Claude to turn the diff-checkable conventions into rules, list the ones it skipped. Starter rules without a key.
- Three rule types that cover most conventions a diff can show:
  - `line`: regex on added lines, scoped by path globs (forbidden imports, raw calls that should use a wrapper).
  - `file`: files that must not be added / modified / deleted (`.env`, `*.db`, applied migrations).
  - `cochange`: files that must change together (schema + migration, module + test).
- `diffrails check`: staged diff for hooks, `--base REF` for CI. Errors block, warnings don't.
  `diffrails-ignore[: rule-id]` silences a line.
- `diffrails install` / `uninstall`: plain git pre-commit hook, respects `core.hooksPath`, never clobbers a
  hook it didn't write.
- `diffrails replay`: run today's rules over the last N commits, optionally only agent-authored ones
  (author or `Co-authored-by` trailer), and rank rules by how often they'd have fired.

## Out of scope (for now)

- Rules that need more than one line of context or a parser (AST rules).
- Checking commit messages.
- Auto-fixing.
