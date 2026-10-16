import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { ruleProblems, type Rule } from "./config.ts";
import { git } from "./git.ts";

export const DEFAULT_MODEL = "claude-sonnet-5-5";
const ROOT_FILES = ["AGENTS.md", "CLAUDE.md", "GEMINI.md", ".cursorrules", ".windsurfrules", ".github/copilot-instructions.md"];
const NESTED = /(^|\/)(AGENTS|CLAUDE)\.md$/;
const MAX_FILE_CHARS = 40_000;

export interface InstructionFile {
  path: string;
  content: string;
}

/** Finds agent instruction files at the root and nested AGENTS.md / CLAUDE.md files tracked by git. */
export function findInstructionFiles(root: string, tracked: string[]): InstructionFile[] {
  const paths = new Set(ROOT_FILES.filter((p) => existsSync(join(root, p))));
  for (const p of tracked) if (NESTED.test(p) && !p.includes("node_modules/")) paths.add(p);
  return [...paths].slice(0, 25).map((path) => ({ path, content: readFileSync(join(root, path), "utf8").slice(0, MAX_FILE_CHARS) }));
}

export function trackedFiles(root: string): string[] {
  return git(root, ["ls-files"]).split("\n").filter(Boolean);
}

/** A compact view of the repo layout so the model can write accurate globs. */
export function layoutSummary(tracked: string[], max = 400): string {
  const dirs = new Map<string, number>();
  for (const p of tracked) {
    const d = dirname(p);
    dirs.set(d, (dirs.get(d) ?? 0) + 1);
  }
  const lines = [...dirs.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([d, n]) => `${d}/ (${n} files)`);
  const sample = tracked.filter((p) => !p.includes("/")).concat(tracked.filter((p) => p.includes("/")).slice(0, 150));
  return [...lines.slice(0, max), "", "Sample files:", ...sample.slice(0, 200)].join("\n");
}

export const writeRulesTool = {
  name: "write_rules",
  description: "Record the diff checks derived from the repository's agent instructions.",
  input_schema: {
    type: "object" as const,
    properties: {
      rules: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string", description: "Short kebab-case id, e.g. no-relative-imports." },
            type: {
              type: "string",
              enum: ["line", "file", "cochange"],
              description:
                "line: regex tested against each added line. file: flags files matching `paths` that are added/modified/deleted/renamed (see `on`). cochange: if a file in `paths` changes, some file in `require` must change in the same commit.",
            },
            message: { type: "string", description: "One sentence telling the author what to do instead." },
            severity: { type: "string", enum: ["error", "warn"], description: "error blocks the commit; use warn when the regex may have false positives." },
            pattern: { type: "string", description: "line rules: JavaScript RegExp source (no slashes), tested against a single added line." },
            flags: { type: "string", description: "line rules: RegExp flags, only i/m/s/u." },
            paths: { type: "array", items: { type: "string" }, description: "Repo-relative globs (`**`, `*`, `{a,b}`). A glob without `/` matches at any depth." },
            exclude: { type: "array", items: { type: "string" }, description: "Globs exempt from the rule, e.g. the wrapper module that is allowed to call the raw API." },
            on: { type: "array", items: { type: "string", enum: ["added", "modified", "deleted", "renamed"] }, description: "file rules: which changes to flag (default added)." },
            require: { type: "array", items: { type: "string" }, description: "cochange rules: globs, at least one of which must also change." },
            source: { type: "string", description: "The instruction this rule enforces, quoted briefly, prefixed with its file, e.g. `AGENTS.md: Never commit .env files`." },
          },
          required: ["id", "type", "message", "source"],
        },
      },
      skipped: {
        type: "array",
        items: { type: "string" },
        description: "Instructions that can't be checked from a diff (style advice, process, judgment calls), one short line each.",
      },
    },
    required: ["rules", "skipped"],
  },
};

export function buildPrompt(files: InstructionFile[], layout: string): string {
  return [
    "You turn a repository's agent instruction files (AGENTS.md, CLAUDE.md, ...) into mechanical checks that run",
    "in a git pre-commit hook against the staged diff. Instruction files drift and agents skip them; these checks",
    "make the conventions that *can* be checked from a diff impossible to miss.",
    "",
    "Guidelines:",
    "- Only write a rule when a diff can show the violation: forbidden imports or calls, files that must not be committed,",
    "  directories that must not be edited, files that must change together. Skip everything else and list it in `skipped`.",
    "- line rules see one added line at a time, without surrounding context. Prefer precise patterns with no false positives;",
    "  use severity warn when a pattern is only a heuristic.",
    "- Scope rules with `paths` / `exclude`. Rules from a nested instruction file apply only under that file's directory.",
    "  Exempt the module that legitimately does the forbidden thing (e.g. the logger wrapper may call console.log).",
    "- Patterns are JavaScript RegExp source. Escape backslashes for JSON as usual.",
    "- Don't invent conventions the files don't state.",
    "",
    "## Repository layout",
    layout,
    "",
    ...files.flatMap((f) => [`## ${f.path}`, "```markdown", f.content.trim(), "```", ""]),
    `Call the ${writeRulesTool.name} tool with the rules and the skipped instructions.`,
  ].join("\n");
}

export interface GeneratedRules {
  rules: Rule[];
  skipped: string[];
  dropped: { rule: unknown; problems: string[] }[];
}

/** Validates the model's tool input; invalid rules are dropped and reported rather than failing the run. */
export function parseGeneratedRules(input: unknown): GeneratedRules {
  const raw = (input ?? {}) as { rules?: unknown; skipped?: unknown };
  const rules: Rule[] = [];
  const dropped: GeneratedRules["dropped"] = [];
  const seen = new Set<string>();
  for (const candidate of Array.isArray(raw.rules) ? raw.rules : []) {
    const rule = Object.fromEntries(
      Object.entries(candidate as Record<string, unknown>).filter(([, v]) => v !== null && v !== "" && !(Array.isArray(v) && !v.length)),
    );
    const problems = ruleProblems(rule);
    if (typeof rule.id === "string" && seen.has(rule.id)) problems.push("duplicate id");
    if (problems.length) dropped.push({ rule: candidate, problems });
    else {
      seen.add(rule.id as string);
      rules.push(rule as unknown as Rule);
    }
  }
  const skipped = Array.isArray(raw.skipped) ? raw.skipped.filter((s): s is string => typeof s === "string") : [];
  return { rules, skipped, dropped };
}

export interface GenerateOptions {
  apiKey: string;
  model?: string;
  baseUrl?: string;
  fetch?: typeof fetch;
}

export async function generateRules(files: InstructionFile[], layout: string, options: GenerateOptions): Promise<GeneratedRules> {
  const { apiKey, model = DEFAULT_MODEL, baseUrl = "https://api.anthropic.com", fetch: doFetch = fetch } = options;
  const res = await doFetch(`${baseUrl.replace(/\/$/, "")}/v1/messages`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model,
      max_tokens: 8192,
      tools: [writeRulesTool],
      // Some newer models reject a forced tool_choice, so the prompt asks for the call instead.
      tool_choice: { type: "auto" },
      messages: [{ role: "user", content: buildPrompt(files, layout) }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${(await res.text()).slice(0, 500)}`);
  const body = (await res.json()) as { content?: { type: string; name?: string; input?: unknown }[]; stop_reason?: string };
  const call = body.content?.find((b) => b.type === "tool_use" && b.name === writeRulesTool.name);
  if (!call) throw new Error(`${model} did not call ${writeRulesTool.name} (stop_reason: ${body.stop_reason})`);
  return parseGeneratedRules(call.input);
}
