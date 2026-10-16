#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { CONFIG_FILE, ConfigError, loadConfig, STARTER_RULES, type Config } from "./config.ts";
import { parseDiff } from "./diff.ts";
import { rangeDiff, repoRoot, stagedDiff } from "./git.ts";
import { installHook, uninstallHook } from "./hook.ts";
import { DEFAULT_MODEL, findInstructionFiles, generateRules, layoutSummary, trackedFiles } from "./init.ts";
import { formatReplay, replay } from "./replay.ts";
import { formatViolations, styleFor } from "./report.ts";
import { evaluate } from "./rules.ts";

const HELP = `diffrails: turn AGENTS.md / CLAUDE.md conventions into pre-commit checks on the git diff

Usage:
  diffrails init [--from FILE...] [--model ID] [--print] [--force]
      Read the repo's agent instruction files and write ${CONFIG_FILE} with Claude
      (needs ANTHROPIC_API_KEY; without it, writes a starter config).
  diffrails check [--base REF [--head REF]] [--json]
      Check the staged diff (default) or the changes on HEAD since REF. Exits 1 on errors.
  diffrails install [--force]     Install a git pre-commit hook that runs \`diffrails check\`.
  diffrails uninstall             Remove the hook installed by diffrails.
  diffrails replay [-n N] [--agents] [--agent-pattern REGEX] [--rev REV] [--json]
      Run the rules over the last N commits (default 50) and rank the most-violated rules.
      --agents limits it to commits by coding agents (author or Co-authored-by trailer).

Options:
  --config FILE   Config path relative to the repo root (default ${CONFIG_FILE})
  -h, --help      Show this help
  -v, --version   Show the version

Silence a rule on one line with a \`diffrails-ignore\` or \`diffrails-ignore: rule-id\` comment.`;

const version = () =>
  (JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }).version;

async function main(argv: string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      help: { type: "boolean", short: "h" },
      version: { type: "boolean", short: "v" },
      config: { type: "string", default: CONFIG_FILE },
      json: { type: "boolean" },
      base: { type: "string" },
      head: { type: "string", default: "HEAD" },
      force: { type: "boolean" },
      from: { type: "string", multiple: true },
      model: { type: "string" },
      print: { type: "boolean" },
      n: { type: "string", short: "n", default: "50" },
      rev: { type: "string" },
      agents: { type: "boolean" },
      "agent-pattern": { type: "string" },
    },
  });
  const [command = values.version ? "version" : "help"] = positionals;
  if (values.help || command === "help") return void console.log(HELP), 0;
  if (command === "version") return void console.log(version()), 0;

  const root = repoRoot(process.cwd());
  const err = styleFor(process.stderr);

  switch (command) {
    case "check": {
      const config = loadConfig(root, values.config);
      const diff = values.base ? rangeDiff(root, values.base, values.head) : stagedDiff(root);
      const violations = evaluate(parseDiff(diff), config);
      const failed = violations.some((v) => v.severity === "error");
      if (values.json) console.log(JSON.stringify({ violations }, null, 2));
      else if (violations.length) {
        console.error(formatViolations(violations, err));
        if (failed && !values.base) console.error(err.dim("Fix the issues, or bypass once with `git commit --no-verify`."));
      }
      return failed ? 1 : 0;
    }

    case "install": {
      const path = installHook(root, { force: values.force });
      console.log(`Installed pre-commit hook at ${path}`);
      if (!existsSync(resolve(root, values.config))) console.log(`No ${values.config} yet; run \`diffrails init\` next.`);
      return 0;
    }

    case "uninstall": {
      const path = uninstallHook(root);
      console.log(path ? `Removed ${path}` : "No diffrails pre-commit hook installed.");
      return 0;
    }

    case "replay": {
      const config = loadConfig(root, values.config);
      const limit = Number(values.n);
      if (!Number.isInteger(limit) || limit < 1) throw new ConfigError("-n must be a positive integer");
      const result = replay(root, config, {
        limit,
        rev: values.rev,
        agentsOnly: values.agents,
        agentPattern: values["agent-pattern"] ? new RegExp(values["agent-pattern"], "i") : undefined,
      });
      if (values.json) console.log(JSON.stringify(result, null, 2));
      else console.log(formatReplay(result));
      return 0;
    }

    case "init": {
      const target = resolve(root, values.config);
      if (existsSync(target) && !values.force && !values.print)
        throw new ConfigError(`${values.config} already exists; rerun with --force to regenerate it.`);
      const tracked = trackedFiles(root);
      const files = values.from
        ? values.from.map((path) => ({ path, content: readFileSync(join(root, path), "utf8") }))
        : findInstructionFiles(root, tracked);
      let config: Config;
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!files.length) {
        console.error(err.yellow("No AGENTS.md, CLAUDE.md, or similar instruction files found; writing starter rules."));
        config = { version: 1, rules: STARTER_RULES };
      } else if (!apiKey) {
        console.error(err.yellow("ANTHROPIC_API_KEY is not set; writing starter rules. Set it and rerun with --force to derive rules from:"));
        for (const f of files) console.error(`  ${f.path}`);
        config = { version: 1, rules: STARTER_RULES };
      } else {
        const model = values.model ?? process.env.DIFFRAILS_MODEL ?? DEFAULT_MODEL;
        console.error(err.dim(`Reading ${files.map((f) => f.path).join(", ")} with ${model}…`));
        const generated = await generateRules(files, layoutSummary(tracked), { apiKey, model, baseUrl: process.env.ANTHROPIC_BASE_URL });
        config = { version: 1, rules: generated.rules };
        for (const d of generated.dropped)
          console.error(err.yellow(`Dropped invalid rule ${(d.rule as { id?: string })?.id ?? "?"}: ${d.problems.join("; ")}`));
        if (generated.skipped.length) {
          console.error(err.dim("\nNot checkable from a diff (left to review):"));
          for (const s of generated.skipped) console.error(err.dim(`  - ${s}`));
        }
      }
      const json = `${JSON.stringify(config, null, 2)}\n`;
      if (values.print) process.stdout.write(json);
      else {
        writeFileSync(target, json);
        console.error(`\nWrote ${config.rules.length} rules to ${values.config}. Try \`diffrails replay\`, then \`diffrails install\`.`);
      }
      return 0;
    }

    default:
      console.error(`Unknown command: ${command}\n\n${HELP}`);
      return 2;
  }
}

main(process.argv.slice(2)).then(
  (code) => (process.exitCode = code),
  (e: unknown) => {
    const message = e instanceof Error ? e.message : String(e);
    console.error(styleFor(process.stderr).red(`diffrails: ${message}`));
    process.exitCode = e instanceof ConfigError ? 2 : 1;
  },
);
