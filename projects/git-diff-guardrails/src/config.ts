import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { FileStatus } from "./diff.ts";

export const CONFIG_FILE = ".diffrails.json";
export const SEVERITIES = ["error", "warn"] as const;
export const FILE_STATUSES: readonly FileStatus[] = ["added", "modified", "deleted", "renamed"];
export type Severity = (typeof SEVERITIES)[number];

interface BaseRule {
  /** Stable kebab-case id, used in reports and `diffrails-ignore` comments. */
  id: string;
  /** Shown when the rule is violated. Say what to do instead. */
  message: string;
  severity?: Severity;
  /** Globs the rule applies to (default: every file). */
  paths?: string[];
  /** Globs excluded from the rule, e.g. the one module allowed to do the forbidden thing. */
  exclude?: string[];
  /** The convention this rule was derived from, quoted from the instruction file. */
  source?: string;
}

/** Flags added lines that match `pattern`. */
export interface LineRule extends BaseRule {
  type: "line";
  pattern: string;
  /** RegExp flags; only `i`, `m`, `s`, `u` are allowed. */
  flags?: string;
}

/** Flags files in `paths` that the diff adds, modifies, deletes, or renames (default: added). */
export interface FileRule extends BaseRule {
  type: "file";
  paths: string[];
  on?: FileStatus[];
}

/** When a file in `paths` changes, at least one file in `require` must change too. */
export interface CochangeRule extends BaseRule {
  type: "cochange";
  paths: string[];
  require: string[];
}

export type Rule = LineRule | FileRule | CochangeRule;

export interface Config {
  version: 1;
  /** Globs no rule looks at (the config file itself is always ignored). */
  ignore?: string[];
  rules: Rule[];
}

export class ConfigError extends Error {}

const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every((s) => typeof s === "string" && s.length > 0);

/** Validates one rule, returning a list of problems (empty when valid). */
export function ruleProblems(raw: unknown): string[] {
  const r = raw as Record<string, unknown>;
  if (!r || typeof r !== "object") return ["rule must be an object"];
  const problems: string[] = [];
  if (typeof r.id !== "string" || !/^[a-z0-9][a-z0-9-]*$/.test(r.id)) problems.push("`id` must be kebab-case");
  if (typeof r.message !== "string" || !r.message.trim()) problems.push("`message` is required");
  if (r.severity !== undefined && !SEVERITIES.includes(r.severity as Severity)) problems.push("`severity` must be error or warn");
  if (r.paths !== undefined && !isStringArray(r.paths)) problems.push("`paths` must be a list of globs");
  if (r.exclude !== undefined && !isStringArray(r.exclude)) problems.push("`exclude` must be a list of globs");
  switch (r.type) {
    case "line":
      if (typeof r.pattern !== "string" || !r.pattern) problems.push("`pattern` is required");
      else if (r.flags !== undefined && (typeof r.flags !== "string" || !/^[imsu]*$/.test(r.flags)))
        problems.push("`flags` may only contain i, m, s, u");
      else {
        try {
          new RegExp(r.pattern, (r.flags as string | undefined) ?? "");
        } catch (e) {
          problems.push(`invalid pattern: ${(e as Error).message}`);
        }
      }
      break;
    case "file":
      if (!isStringArray(r.paths) || !r.paths.length) problems.push("`paths` is required for file rules");
      if (r.on !== undefined && (!Array.isArray(r.on) || !r.on.length || !r.on.every((s) => FILE_STATUSES.includes(s))))
        problems.push(`\`on\` must list some of: ${FILE_STATUSES.join(", ")}`);
      break;
    case "cochange":
      if (!isStringArray(r.paths) || !r.paths.length) problems.push("`paths` is required for cochange rules");
      if (!isStringArray(r.require) || !r.require.length) problems.push("`require` is required for cochange rules");
      break;
    default:
      problems.push("`type` must be line, file, or cochange");
  }
  return problems;
}

export function parseConfig(raw: unknown): Config {
  const c = raw as Record<string, unknown>;
  if (!c || typeof c !== "object" || !Array.isArray(c.rules)) throw new ConfigError("config must have a `rules` array");
  if (c.ignore !== undefined && !isStringArray(c.ignore)) throw new ConfigError("`ignore` must be a list of globs");
  const errors: string[] = [];
  const seen = new Set<string>();
  c.rules.forEach((rule, i) => {
    const label = `rules[${i}]${typeof rule?.id === "string" ? ` (${rule.id})` : ""}`;
    for (const p of ruleProblems(rule)) errors.push(`${label}: ${p}`);
    if (typeof rule?.id === "string") {
      if (seen.has(rule.id)) errors.push(`${label}: duplicate id`);
      seen.add(rule.id);
    }
  });
  if (errors.length) throw new ConfigError(errors.join("\n"));
  return { version: 1, ignore: c.ignore as string[] | undefined, rules: c.rules as Rule[] };
}

export function loadConfig(root: string, file = CONFIG_FILE): Config {
  const path = resolve(root, file);
  if (!existsSync(path)) throw new ConfigError(`No ${file} found in ${root}. Run \`diffrails init\` to create one.`);
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    throw new ConfigError(`${file} is not valid JSON: ${(e as Error).message}`);
  }
  try {
    return parseConfig(raw);
  } catch (e) {
    throw new ConfigError(`${file} is invalid:\n${(e as Error).message}`);
  }
}

/** Rules that make sense in any repo; used by `diffrails init` when no LLM is available. */
export const STARTER_RULES: Rule[] = [
  {
    id: "no-env-files",
    type: "file",
    paths: [".env", ".env.*"],
    exclude: [".env.example", ".env.sample", ".env.template"],
    message: "Don't commit .env files; keep secrets out of git and update .env.example instead.",
  },
  {
    id: "no-conflict-markers",
    type: "line",
    pattern: "^(<{7}|>{7})( |$)",
    message: "Resolve the merge conflict before committing.",
  },
  {
    id: "no-focused-tests",
    type: "line",
    pattern: "\\b(describe|it|test)\\.only\\(",
    paths: ["**/*.{test,spec}.*", "**/__tests__/**"],
    message: "Remove .only() so the whole suite runs.",
  },
];
