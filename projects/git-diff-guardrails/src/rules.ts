import { CONFIG_FILE, type Config, type Rule, type Severity } from "./config.ts";
import type { FileDiff } from "./diff.ts";
import { matchesAny } from "./glob.ts";

export interface Violation {
  ruleId: string;
  severity: Severity;
  message: string;
  path: string;
  line?: number;
  text?: string;
}

const SUPPRESS = /diffrails-ignore(?:[: ]\s*([a-z0-9-]+(?:\s*,\s*[a-z0-9-]+)*))?/;

/** `// diffrails-ignore` silences every rule on that line; `diffrails-ignore: a, b` only rules a and b. */
export function isSuppressed(text: string, ruleId: string): boolean {
  const m = SUPPRESS.exec(text);
  if (!m) return false;
  if (!m[1]) return true;
  return m[1].split(",").some((id) => id.trim() === ruleId);
}

const inScope = (rule: Rule, path: string) =>
  (!rule.paths?.length || matchesAny(path, rule.paths)) && !matchesAny(path, rule.exclude);

export function evaluate(files: FileDiff[], config: Config): Violation[] {
  const ignore = [CONFIG_FILE, ...(config.ignore ?? [])];
  const scoped = files.filter((f) => !matchesAny(f.path, ignore));
  const out: Violation[] = [];

  for (const rule of config.rules) {
    const base = { ruleId: rule.id, severity: rule.severity ?? "error", message: rule.message };
    switch (rule.type) {
      case "line": {
        const re = new RegExp(rule.pattern, rule.flags ?? "");
        for (const f of scoped) {
          if (f.status === "deleted" || f.binary || !inScope(rule, f.path)) continue;
          for (const { line, text } of f.added) {
            if (re.test(text) && !isSuppressed(text, rule.id)) out.push({ ...base, path: f.path, line, text });
          }
        }
        break;
      }
      case "file": {
        const on = rule.on ?? ["added"];
        for (const f of scoped) {
          if (on.includes(f.status) && inScope(rule, f.path)) out.push({ ...base, path: f.path });
        }
        break;
      }
      case "cochange": {
        const trigger = scoped.find((f) => inScope(rule, f.path));
        if (trigger && !scoped.some((f) => matchesAny(f.path, rule.require))) out.push({ ...base, path: trigger.path });
        break;
      }
    }
  }

  return out.sort((a, b) => a.path.localeCompare(b.path) || (a.line ?? 0) - (b.line ?? 0));
}
