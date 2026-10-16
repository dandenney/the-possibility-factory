import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { STARTER_RULES } from "./config.ts";
import { isAgentCommit } from "./replay.ts";
import { tempRepo } from "./test-helpers.ts";

const CLI = join(import.meta.dirname, "cli.ts");
const cli = (cwd: string, ...args: string[]) => {
  const env: NodeJS.ProcessEnv = { ...process.env, NO_COLOR: "1" };
  delete env.ANTHROPIC_API_KEY;
  return spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: "utf8", env });
};

const config = {
  version: 1,
  rules: [
    ...STARTER_RULES,
    { id: "use-alias", type: "line", pattern: "from ['\"]\\.\\.?/", paths: ["src/**"], message: "Import via @/." },
  ],
};

function setup() {
  const repo = tempRepo();
  repo.write(".diffrails.json", JSON.stringify(config));
  repo.write("src/a.ts", "export const a = 1;\n");
  repo.run("add", ".");
  repo.run("commit", "-qm", "init");
  return repo;
}

describe("diffrails check", () => {
  it("passes a clean staged diff and fails a dirty one", () => {
    const { dir, write, run } = setup();
    write("src/b.ts", 'import { a } from "@/a";\n');
    run("add", ".");
    expect(cli(dir, "check").status).toBe(0);

    write("src/c.ts", 'import { a } from "./a";\n');
    write(".env", "SECRET=1\n");
    run("add", ".");
    const res = cli(dir, "check");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("src/c.ts");
    expect(res.stderr).toContain("use-alias");
    expect(res.stderr).toContain("no-env-files");
    expect(res.stderr).toContain("2 errors");

    const json = JSON.parse(cli(dir, "check", "--json").stdout);
    expect(json.violations.map((v: { ruleId: string }) => v.ruleId).sort()).toEqual(["no-env-files", "use-alias"]);
  });

  it("checks a commit range with --base", () => {
    const { dir, write, run } = setup();
    run("checkout", "-qb", "feature");
    write("src/c.ts", 'import { a } from "../a";\n');
    run("add", ".");
    run("commit", "-qm", "relative import");
    expect(cli(dir, "check", "--base", "main").status).toBe(1);
    expect(cli(dir, "check", "--base", "HEAD").status).toBe(0);
  });

  it("explains a missing config", () => {
    const { dir } = tempRepo();
    const res = cli(dir, "check");
    expect(res.status).toBe(2);
    expect(res.stderr).toContain("diffrails init");
  });
});

describe("diffrails install", () => {
  it("installs a hook that blocks bad commits, and uninstalls it", () => {
    const { dir, write, run } = setup();
    expect(cli(dir, "install").status).toBe(0);
    const hook = join(dir, ".git/hooks/pre-commit");
    expect(readFileSync(hook, "utf8")).toContain("Installed by diffrails");

    write("src/d.ts", 'import { a } from "./a";\n');
    run("add", ".");
    expect(() => run("commit", "-qm", "bad")).toThrow();
    write("src/d.ts", 'import { a } from "@/a";\n');
    run("add", ".");
    expect(() => run("commit", "-qm", "good")).not.toThrow();

    expect(cli(dir, "uninstall").stdout).toContain("Removed");
    expect(existsSync(hook)).toBe(false);
  });

  it("respects core.hooksPath and won't clobber foreign hooks", () => {
    const { dir, write, run } = setup();
    run("config", "core.hooksPath", ".githooks");
    write(".githooks/pre-commit", "#!/bin/sh\necho mine\n");
    const res = cli(dir, "install");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("already exists");
    expect(cli(dir, "install", "--force").status).toBe(0);
    expect(readFileSync(join(dir, ".githooks/pre-commit"), "utf8")).toContain("diffrails");
  });
});

describe("diffrails replay", () => {
  it("ranks rules over history and filters agent commits", () => {
    const { dir, write, run } = setup();
    write("src/e.ts", 'import { a } from "./a";\n');
    run("add", ".");
    run("commit", "-qm", "agent change", "-m", "Co-Authored-By: Devin AI <devin@example.com>");
    write("src/f.ts", 'import { a } from "./a";\n');
    write(".env", "X=1\n");
    run("add", ".");
    run("commit", "-qm", "human change");

    const all = cli(dir, "replay");
    expect(all.status).toBe(0);
    expect(all.stdout).toContain("Replayed 3 commits; 2 would have been flagged.");
    expect(all.stdout).toMatch(/use-alias\s+2\s+2/);

    const agents = JSON.parse(cli(dir, "replay", "--agents", "--json").stdout);
    expect(agents.scanned).toBe(1);
    expect(agents.results[0].commit.subject).toBe("agent change");
  });

  it("detects agent authors and trailers", () => {
    const base = { sha: "x", subject: "s", body: "" };
    expect(isAgentCommit({ ...base, author: "devin-ai-integration[bot]", email: "x@users.noreply.github.com" })).toBe(true);
    expect(isAgentCommit({ ...base, author: "Dan", email: "d@x.com", body: "Co-authored-by: Claude <noreply@anthropic.com>" })).toBe(true);
    expect(isAgentCommit({ ...base, author: "Dan", email: "d@x.com", body: "Mentions claude in the body" })).toBe(false);
    expect(isAgentCommit({ ...base, author: "dependabot[bot]", email: "x" })).toBe(false);
  });
});

describe("diffrails init", () => {
  it("writes starter rules without an API key and refuses to overwrite", () => {
    const { dir, write } = tempRepo();
    write("AGENTS.md", "- Never commit .env files");
    const res = cli(dir, "init");
    expect(res.status).toBe(0);
    expect(res.stderr).toContain("ANTHROPIC_API_KEY is not set");
    expect(JSON.parse(readFileSync(join(dir, ".diffrails.json"), "utf8")).rules).toHaveLength(STARTER_RULES.length);
    expect(cli(dir, "init").status).toBe(2);
  });
});
