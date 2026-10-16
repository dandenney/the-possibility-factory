import type { Violation } from "./rules.ts";

export interface Style {
  red: (s: string) => string;
  yellow: (s: string) => string;
  dim: (s: string) => string;
  bold: (s: string) => string;
}

const wrap = (open: number, close: number) => (s: string) => `\x1b[${open}m${s}\x1b[${close}m`;
export const colors: Style = { red: wrap(31, 39), yellow: wrap(33, 39), dim: wrap(2, 22), bold: wrap(1, 22) };
export const plain: Style = { red: (s) => s, yellow: (s) => s, dim: (s) => s, bold: (s) => s };

export function styleFor(stream: { isTTY?: boolean }): Style {
  return stream.isTTY && !process.env.NO_COLOR ? colors : plain;
}

const truncate = (s: string, n = 120) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export function formatViolations(violations: Violation[], style: Style = plain): string {
  if (!violations.length) return "";
  const lines: string[] = [];
  let lastPath = "";
  for (const v of violations) {
    if (v.path !== lastPath) {
      if (lastPath) lines.push("");
      lines.push(style.bold(v.path));
      lastPath = v.path;
    }
    const sev = v.severity === "error" ? style.red("error") : style.yellow("warn ");
    const loc = (v.line ? String(v.line) : "-").padStart(5);
    lines.push(`${loc}  ${sev}  ${v.message}  ${style.dim(v.ruleId)}`);
    if (v.text !== undefined) lines.push(style.dim(`       │ ${truncate(v.text.trim())}`));
  }
  const errors = violations.filter((v) => v.severity === "error").length;
  const warns = violations.length - errors;
  lines.push("", summary(errors, warns, style));
  return lines.join("\n");
}

export function summary(errors: number, warns: number, style: Style = plain): string {
  const parts = [];
  if (errors) parts.push(style.red(`${errors} error${errors === 1 ? "" : "s"}`));
  if (warns) parts.push(style.yellow(`${warns} warning${warns === 1 ? "" : "s"}`));
  return `diffrails: ${parts.join(", ")}`;
}
