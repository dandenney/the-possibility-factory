import { chmodSync, existsSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { hooksDir } from "./git.ts";

const MARKER = "# Installed by diffrails";

export function hookScript(fallbackCli: string): string {
  const cli = fallbackCli.replace(/"/g, '\\"');
  return `#!/bin/sh
${MARKER}. Remove with: diffrails uninstall
# Checks the staged diff against .diffrails.json. Bypass once with: git commit --no-verify
if [ -x ./node_modules/.bin/diffrails ]; then
  exec ./node_modules/.bin/diffrails check
elif command -v diffrails >/dev/null 2>&1; then
  exec diffrails check
else
  exec node "${cli}" check
fi
`;
}

export function installHook(cwd: string, { force = false, cli = process.argv[1] ?? "" } = {}): string {
  const dir = hooksDir(cwd);
  const path = join(dir, "pre-commit");
  if (existsSync(path) && !readFileSync(path, "utf8").includes(MARKER) && !force) {
    throw new Error(
      `${path} already exists and wasn't written by diffrails.\n` +
        "Add `diffrails check` to it (or to your husky/lefthook config), or rerun with --force to replace it.",
    );
  }
  mkdirSync(dir, { recursive: true });
  writeFileSync(path, hookScript(cli ? realpathSync(cli) : "diffrails"));
  chmodSync(path, 0o755);
  return path;
}

/** Removes the hook if diffrails installed it. Returns the removed path, if any. */
export function uninstallHook(cwd: string): string | undefined {
  const path = join(hooksDir(cwd), "pre-commit");
  if (!existsSync(path) || !readFileSync(path, "utf8").includes(MARKER)) return undefined;
  rmSync(path);
  return path;
}
