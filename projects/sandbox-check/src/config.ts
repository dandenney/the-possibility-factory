// How the untrusted HTML gets rendered: embed method, sandbox tokens, CSP and Permissions Policy.
// No DOM in here so it stays testable.

import { probeMain, SENSITIVE_FEATURES, type ProbeOptions } from "./payload.ts";

export type Embed = "srcdoc" | "blob" | "data";

export const EMBEDS: { id: Embed; label: string; note: string }[] = [
  { id: "srcdoc", label: "srcdoc", note: "HTML in the attribute. Inherits your origin unless sandboxed." },
  { id: "blob", label: "Blob URL", note: "URL.createObjectURL(). Also inherits your origin unless sandboxed." },
  { id: "data", label: "data: URL", note: "Always gets an opaque origin, sandbox or not." },
];

export const TOKENS = [
  { id: "allow-scripts", note: "Run JavaScript. Most previews need it." },
  { id: "allow-same-origin", note: "Keep the real origin. With allow-scripts on srcdoc or blob, the sandbox is gone." },
  { id: "allow-forms", note: "Submit forms, including phishing forms that post somewhere else." },
  { id: "allow-popups", note: "Open new windows (they inherit the sandbox)." },
  { id: "allow-popups-to-escape-sandbox", note: "Popups open without the sandbox." },
  { id: "allow-top-navigation", note: "Send your whole tab to another URL, no click needed." },
  { id: "allow-top-navigation-by-user-activation", note: "Same, but only after a click inside the frame." },
  { id: "allow-modals", note: "alert(), confirm() and prompt() over your UI." },
  { id: "allow-downloads", note: "Start file downloads." },
] as const;

export type Token = (typeof TOKENS)[number]["id"];
const TOKEN_IDS = new Set<string>(TOKENS.map((t) => t.id));

export type CspPreset = "none" | "no-network" | "custom";

/** A meta CSP inside the frame. 'unsafe-inline' scripts stay on so the probe can run, like most artifacts. */
export const NO_NETWORK_CSP =
  "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; form-action 'none'";

export interface Config {
  embed: Embed;
  /** null means no sandbox attribute at all. */
  sandbox: Token[] | null;
  csp: CspPreset;
  customCsp: string;
  /** The iframe allow attribute (Permissions Policy). */
  allow: string;
}

export interface Preset {
  id: string;
  label: string;
  blurb: string;
  config: Config;
}

const base: Config = { embed: "srcdoc", sandbox: ["allow-scripts"], csp: "none", customCsp: "", allow: "" };

export const PRESETS: Preset[] = [
  {
    id: "scripts-only",
    label: "Scripts only",
    blurb: "The usual artifact setup: sandbox=\"allow-scripts\" and nothing else. Contained, but it can still send data out.",
    config: { ...base },
  },
  {
    id: "locked",
    label: "Scripts + no-network CSP",
    blurb: "Scripts only, plus a CSP inside the frame that blocks fetch, images from the network and form posts.",
    config: { ...base, csp: "no-network" },
  },
  {
    id: "same-origin",
    label: "The classic mistake",
    blurb: "allow-scripts with allow-same-origin on srcdoc. The frame can reach in and remove its own sandbox.",
    config: { ...base, sandbox: ["allow-scripts", "allow-same-origin"] },
  },
  {
    id: "blob-bare",
    label: "Blob URL, no sandbox",
    blurb: "A blob URL inherits your origin. Without a sandbox it's your page.",
    config: { ...base, embed: "blob", sandbox: null },
  },
  {
    id: "generous",
    label: "Generous tokens",
    blurb: "Popups that escape the sandbox, forms and top navigation: each one a door left open.",
    config: {
      ...base,
      sandbox: ["allow-scripts", "allow-forms", "allow-popups", "allow-popups-to-escape-sandbox", "allow-top-navigation"],
      allow: "clipboard-write; camera",
    },
  },
];

export function cspFor(c: Config): string {
  if (c.csp === "no-network") return NO_NETWORK_CSP;
  if (c.csp === "custom") return c.customCsp.trim();
  return "";
}

/** Shared escape for anything placed inside a double-quoted HTML attribute. */
export function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** The untrusted page: an optional CSP meta tag and the probe script. */
export function buildDocument(c: Config | null, opts: ProbeOptions): string {
  const csp = c ? cspFor(c) : "";
  // JSON can't close the script tag early once "<" is escaped.
  const args = JSON.stringify(opts).replace(/</g, "\\u003c");
  return [
    "<!doctype html>",
    '<html lang="en"><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    csp ? `<meta http-equiv="Content-Security-Policy" content="${escapeAttr(csp)}">` : "",
    "<title>sandbox-check probe</title></head><body>",
    `<script>(${probeMain.toString()})(${args});</script>`,
    "</body></html>",
  ].join("\n");
}

export function probeOptions(o: Omit<ProbeOptions, "sensitive">): ProbeOptions {
  return { ...o, sensitive: [...SENSITIVE_FEATURES] };
}

export interface FrameAttrs {
  sandbox: string | null;
  allow: string;
}

export function frameAttrs(c: Config): FrameAttrs {
  return { sandbox: c.sandbox ? c.sandbox.join(" ") : null, allow: c.allow.trim() };
}

/** The iframe markup a developer would ship for this config. */
export function snippet(c: Config): string {
  const a = frameAttrs(c);
  const src =
    c.embed === "srcdoc"
      ? 'srcdoc="…escaped HTML…"'
      : c.embed === "blob"
        ? 'src="blob:…"  <!-- URL.createObjectURL(new Blob([html], { type: "text/html" })) -->'
        : 'src="data:text/html;base64,…"';
  const attrs = [
    a.sandbox === null ? "<!-- no sandbox attribute -->" : `sandbox="${a.sandbox}"`,
    a.allow ? `allow="${escapeAttr(a.allow)}"` : "",
    src,
  ].filter(Boolean);
  const lines = [`<iframe`, ...attrs.map((x) => `  ${x}`), `></iframe>`];
  const csp = cspFor(c);
  if (csp) lines.push("", "<!-- first thing inside the framed HTML -->", `<meta http-equiv="Content-Security-Policy" content="${escapeAttr(csp)}">`);
  return lines.join("\n");
}

// ---------- Share links ----------

const EMBED_IDS = new Set<string>(EMBEDS.map((e) => e.id));

export function encodeConfig(c: Config): string {
  const p = new URLSearchParams({ e: c.embed, s: c.sandbox === null ? "-" : c.sandbox.join(" ") });
  if (c.csp !== "none") p.set("c", c.csp);
  if (c.csp === "custom" && c.customCsp.trim()) p.set("cc", c.customCsp.trim());
  if (c.allow.trim()) p.set("a", c.allow.trim());
  return p.toString();
}

export function decodeConfig(search: string): Config | undefined {
  const p = new URLSearchParams(search);
  const e = p.get("e");
  const s = p.get("s");
  if (!e || !EMBED_IDS.has(e) || s === null) return undefined;
  const sandbox = s === "-" ? null : [...new Set(s.split(/\s+/).filter((t) => TOKEN_IDS.has(t)))] as Token[];
  const c = p.get("c");
  const csp: CspPreset = c === "no-network" || c === "custom" ? c : "none";
  return {
    embed: e as Embed,
    sandbox,
    csp,
    customCsp: csp === "custom" ? (p.get("cc") ?? "").slice(0, 2000) : "",
    allow: (p.get("a") ?? "").slice(0, 500),
  };
}

export function sameConfig(a: Config, b: Config): boolean {
  return encodeConfig(a) === encodeConfig(b);
}
