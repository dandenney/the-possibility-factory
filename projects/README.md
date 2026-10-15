# projects/

Things the factory builds. Each subdirectory is one self-contained project with its own
stack, lockfile, `README.md`, and `AGENTS.md`. Projects are not pnpm workspace members, so
a Python, Go, or Rust project can sit next to a JS one without affecting the factory.

Conventions for a new project at `projects/<slug>/`:

- `SPEC.md`: the idea spec the project was built from (written by the factory).
- `AGENTS.md`: how to install, run, test, and deploy this project.
- No imports from `apps/` or `packages/`; a project must be movable to its own repo.
