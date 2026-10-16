import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const DIFF_FLAGS = ["--no-color", "--no-ext-diff", "-U0", "--find-renames", "--src-prefix=a/", "--dst-prefix=b/"];

export function git(cwd: string, args: string[]): string {
  return execFileSync("git", ["-c", "core.quotePath=false", ...args], {
    cwd,
    encoding: "utf8",
    maxBuffer: 512 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

export function repoRoot(cwd: string): string {
  try {
    return git(cwd, ["rev-parse", "--show-toplevel"]).trim();
  } catch {
    throw new Error(`${cwd} is not inside a git repository`);
  }
}

export function hooksDir(cwd: string): string {
  return resolve(cwd, git(cwd, ["rev-parse", "--git-path", "hooks"]).trim());
}

export const stagedDiff = (cwd: string) => git(cwd, ["diff", "--cached", ...DIFF_FLAGS]);

/** Changes on `head` since it diverged from `base` (what a PR would show). */
export const rangeDiff = (cwd: string, base: string, head = "HEAD") => git(cwd, ["diff", ...DIFF_FLAGS, `${base}...${head}`]);

export const commitDiff = (cwd: string, sha: string) =>
  git(cwd, ["show", "--format=", "--first-parent", ...DIFF_FLAGS, sha]);

export interface Commit {
  sha: string;
  author: string;
  email: string;
  subject: string;
  body: string;
}

export function listCommits(cwd: string, { limit, rev = "HEAD" }: { limit: number; rev?: string }): Commit[] {
  const out = git(cwd, ["log", "--no-merges", `-n${limit}`, "--format=%H%x1f%an%x1f%ae%x1f%s%x1f%b%x1e", rev]);
  return out
    .split("\x1e")
    .map((r) => r.replace(/^\n/, ""))
    .filter(Boolean)
    .map((r) => {
      const [sha = "", author = "", email = "", subject = "", body = ""] = r.split("\x1f");
      return { sha, author, email, subject, body: body.trim() };
    });
}
