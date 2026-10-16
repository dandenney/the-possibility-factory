import type { Config } from "./config.ts";
import { parseDiff } from "./diff.ts";
import { commitDiff, listCommits, type Commit } from "./git.ts";
import { evaluate, type Violation } from "./rules.ts";

/** Matches agent authors and `Co-authored-by` trailers (Devin, Claude Code, Codex, Copilot, ...). */
export const AGENT_PATTERN =
  /\b(devin|claude|codex|copilot|cursor|aider|gemini|openhands|jules|sweep|amp(?:code)?)\b|\bnoreply@anthropic\.com\b/i;

export function isAgentCommit(commit: Commit, pattern: RegExp = AGENT_PATTERN): boolean {
  if (pattern.test(`${commit.author} <${commit.email}>`)) return true;
  return commit.body
    .split("\n")
    .some((line) => /^co-authored-by:/i.test(line.trim()) && pattern.test(line));
}

export interface CommitResult {
  commit: Commit;
  agent: boolean;
  violations: Violation[];
}

export interface RuleStat {
  ruleId: string;
  violations: number;
  commits: number;
}

export interface ReplayResult {
  scanned: number;
  results: CommitResult[];
  rules: RuleStat[];
}

export interface ReplayOptions {
  limit?: number;
  rev?: string;
  agentsOnly?: boolean;
  /** Custom regex for "agent" authors; replaces AGENT_PATTERN. */
  agentPattern?: RegExp;
}

export function replay(root: string, config: Config, options: ReplayOptions = {}): ReplayResult {
  const { limit = 50, rev, agentsOnly = false, agentPattern } = options;
  const commits = listCommits(root, { limit, rev });
  const results: CommitResult[] = [];
  for (const commit of commits) {
    const agent = isAgentCommit(commit, agentPattern);
    if (agentsOnly && !agent) continue;
    results.push({ commit, agent, violations: evaluate(parseDiff(commitDiff(root, commit.sha)), config) });
  }
  return { scanned: results.length, results, rules: summarize(results, config) };
}

export function summarize(results: CommitResult[], config: Config): RuleStat[] {
  return config.rules
    .map((rule) => {
      const hits = results.map((r) => r.violations.filter((v) => v.ruleId === rule.id).length);
      return { ruleId: rule.id, violations: hits.reduce((a, b) => a + b, 0), commits: hits.filter(Boolean).length };
    })
    .sort((a, b) => b.commits - a.commits || b.violations - a.violations || a.ruleId.localeCompare(b.ruleId));
}

export function formatReplay({ scanned, results, rules }: ReplayResult, top = 10): string {
  if (!scanned) return "No commits to replay.";
  const flagged = results.filter((r) => r.violations.length);
  const idWidth = Math.max(4, ...rules.map((r) => r.ruleId.length));
  const lines = [
    `Replayed ${scanned} commit${scanned === 1 ? "" : "s"}; ${flagged.length} would have been flagged.`,
    "",
    `${"rule".padEnd(idWidth)}  commits  hits`,
    ...rules.map(
      (r) =>
        `${r.ruleId.padEnd(idWidth)}  ${String(r.commits).padStart(7)}  ${String(r.violations).padStart(4)}`,
    ),
  ];
  if (flagged.length) {
    lines.push("", "Most-flagged commits:");
    for (const r of [...flagged].sort((a, b) => b.violations.length - a.violations.length).slice(0, top)) {
      const ids = [...new Set(r.violations.map((v) => v.ruleId))].join(", ");
      lines.push(`  ${r.commit.sha.slice(0, 7)}  ${r.violations.length.toString().padStart(3)}  ${r.commit.subject}  (${ids})`);
    }
  }
  return lines.join("\n");
}
