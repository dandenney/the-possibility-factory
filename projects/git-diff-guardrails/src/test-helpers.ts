import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

export function tempRepo() {
  const dir = mkdtempSync(join(tmpdir(), "diffrails-"));
  const run = (...args: string[]) =>
    execFileSync("git", args, {
      cwd: dir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, GIT_AUTHOR_NAME: "Dan", GIT_AUTHOR_EMAIL: "dan@example.com", GIT_COMMITTER_NAME: "Dan", GIT_COMMITTER_EMAIL: "dan@example.com" },
    });
  run("init", "-q", "-b", "main");
  run("config", "commit.gpgsign", "false");
  const write = (path: string, content: string) => {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), content);
  };
  return { dir, run, write };
}
