import "./style.css";
import {
  buildDocument,
  decodeConfig,
  EMBEDS,
  encodeConfig,
  frameAttrs,
  PRESETS,
  probeOptions,
  sameConfig,
  snippet,
  TOKENS,
  type Config,
  type CspPreset,
  type Embed,
  type Token,
} from "./config.ts";
import type { Fact, ProbeMessage } from "./payload.ts";
import { judge, summarize, toMarkdown, type Finding, type Observed } from "./verdict.ts";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const ui = {
  presets: $("presets"),
  presetBlurb: $("preset-blurb"),
  embeds: $("embeds"),
  useSandbox: $<HTMLInputElement>("use-sandbox"),
  tokens: $("tokens"),
  csps: $("csps"),
  customCsp: $<HTMLTextAreaElement>("custom-csp"),
  allow: $<HTMLInputElement>("allow"),
  snippet: $("snippet"),
  copySnippet: $<HTMLButtonElement>("copy-snippet"),
  summary: $("summary"),
  summaryTitle: $("summary-title"),
  summaryBlurb: $("summary-blurb"),
  counts: $("counts"),
  rerun: $<HTMLButtonElement>("rerun"),
  slot: $("frame-slot"),
  findings: $("findings"),
  copyReport: $<HTMLButtonElement>("copy-report"),
  copyLink: $<HTMLButtonElement>("copy-link"),
  copyProbe: $<HTMLButtonElement>("copy-probe"),
  toast: $("toast"),
};

const SETTLE_MS = 2500;
const NAV_RE = /^#sck-(top-nav|top-nav-click)-([a-z0-9]+)$/;
/** Tokens remembered while the sandbox is switched off, so turning it back on restores them. */
let rememberedTokens: Token[] = ["allow-scripts"];

let config: Config = decodeConfig(location.search) ?? structuredClone(PRESETS[0]!.config);
let frame: HTMLIFrameElement | null = null;
let blobUrl = "";
let nonce = "";
let settleTimer = 0;
let observed: Observed = fresh();
let findings: Finding[] = [];

function fresh(): Observed {
  return { facts: [], settled: false, navigated: new Set(), origin: location.origin };
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, unknown> = {}, ...kids: (Node | string)[]): HTMLElementTagNameMap[K] {
  const node: HTMLElementTagNameMap[K] = Object.assign(document.createElement(tag), props);
  node.append(...kids);
  return node;
}

function randomId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => b.toString(36).padStart(2, "0")).join("");
}

function siteUrl(): string {
  return `${location.origin}${location.pathname}?${encodeConfig(config)}`;
}

// ---------- Controls ----------

function buildControls() {
  for (const p of PRESETS) {
    const b = el("button", { type: "button", className: "chip" }, p.label);
    b.dataset.preset = p.id;
    b.addEventListener("click", () => {
      config = structuredClone(p.config);
      if (config.sandbox) rememberedTokens = [...config.sandbox];
      changed();
    });
    ui.presets.append(b);
  }

  for (const e of EMBEDS) {
    const input = el("input", { type: "radio", name: "embed", value: e.id });
    input.addEventListener("change", () => {
      config.embed = e.id as Embed;
      changed();
    });
    ui.embeds.append(el("label", { title: e.note }, input, " ", el("span", {}, e.label)));
  }

  for (const t of TOKENS) {
    const input = el("input", { type: "checkbox", value: t.id });
    input.addEventListener("change", () => {
      const set = new Set(config.sandbox ?? []);
      if (input.checked) set.add(t.id);
      else set.delete(t.id);
      // Keep the canonical token order so links and snippets stay stable.
      config.sandbox = TOKENS.map((x) => x.id).filter((id) => set.has(id));
      rememberedTokens = [...config.sandbox];
      changed();
    });
    ui.tokens.append(
      el("li", {}, el("label", {}, input, el("span", {}, el("code", {}, t.id), el("small", {}, t.note)))),
    );
  }

  ui.useSandbox.addEventListener("change", () => {
    config.sandbox = ui.useSandbox.checked ? [...rememberedTokens] : null;
    changed();
  });

  for (const input of ui.csps.querySelectorAll<HTMLInputElement>("input[name=csp]")) {
    input.addEventListener("change", () => {
      config.csp = input.value as CspPreset;
      changed();
      if (config.csp === "custom") ui.customCsp.focus();
    });
  }

  let typing = 0;
  const debounced = (fn: () => void) => {
    window.clearTimeout(typing);
    typing = window.setTimeout(fn, 400);
  };
  ui.customCsp.addEventListener("input", () => {
    config.customCsp = ui.customCsp.value;
    debounced(changed);
  });
  ui.allow.addEventListener("input", () => {
    config.allow = ui.allow.value;
    debounced(changed);
  });
}

function syncControls() {
  const preset = PRESETS.find((p) => sameConfig(p.config, config));
  for (const b of ui.presets.querySelectorAll<HTMLButtonElement>("button")) {
    b.setAttribute("aria-pressed", String(b.dataset.preset === preset?.id));
  }
  ui.presetBlurb.textContent = preset ? preset.blurb : "Custom setup.";

  for (const input of ui.embeds.querySelectorAll<HTMLInputElement>("input")) input.checked = input.value === config.embed;
  ui.useSandbox.checked = config.sandbox !== null;
  ui.tokens.classList.toggle("off", config.sandbox === null);
  for (const input of ui.tokens.querySelectorAll<HTMLInputElement>("input")) {
    input.checked = !!config.sandbox?.includes(input.value as Token);
    input.disabled = config.sandbox === null;
  }
  for (const input of ui.csps.querySelectorAll<HTMLInputElement>("input")) input.checked = input.value === config.csp;
  ui.customCsp.hidden = config.csp !== "custom";
  if (document.activeElement !== ui.customCsp) ui.customCsp.value = config.customCsp;
  if (document.activeElement !== ui.allow) ui.allow.value = config.allow;
  ui.snippet.textContent = snippet(config);
}

function changed() {
  history.replaceState(null, "", `?${encodeConfig(config)}`);
  syncControls();
  run();
}

// ---------- Running the probe ----------

function plantCanaries(value: string) {
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `sck_canary=${value}; path=/; SameSite=Lax${secure}`;
  try {
    localStorage.setItem("sck-canary", value);
  } catch {
    /* storage blocked; the storage probe will just read nothing */
  }
}

function toBase64(text: string): string {
  let bin = "";
  for (const b of new TextEncoder().encode(text)) bin += String.fromCharCode(b);
  return btoa(bin);
}

function run() {
  window.clearTimeout(settleTimer);
  if (blobUrl) URL.revokeObjectURL(blobUrl);
  blobUrl = "";
  frame?.remove();

  nonce = randomId();
  observed = fresh();
  plantCanaries(nonce);

  const html = buildDocument(
    config,
    probeOptions({
      nonce,
      mode: "kit",
      kitOrigin: location.origin,
      topUrl: `${location.origin}${location.pathname}${location.search}`,
      canary: nonce,
    }),
  );
  const attrs = frameAttrs(config);
  const f = el("iframe", { title: "Untrusted page running the probes" });
  if (attrs.sandbox !== null) f.setAttribute("sandbox", attrs.sandbox);
  if (attrs.allow) f.setAttribute("allow", attrs.allow);
  if (config.embed === "srcdoc") f.srcdoc = html;
  else if (config.embed === "blob") f.src = blobUrl = URL.createObjectURL(new Blob([html], { type: "text/html" }));
  else f.src = `data:text/html;base64,${toBase64(html)}`;
  frame = f;
  ui.slot.replaceChildren(f);

  settleTimer = window.setTimeout(() => {
    observed.settled = true;
    render();
  }, SETTLE_MS);
  render();
}

// Only trust messages from the frame we made, for this run. event.origin is "null" for any sandboxed frame,
// so it can't tell our frame from someone else's.
window.addEventListener("message", (event: MessageEvent<ProbeMessage>) => {
  if (!frame || event.source !== frame.contentWindow) return;
  const data = event.data;
  if (!data || data.kit !== "sandbox-check" || data.nonce !== nonce || !Array.isArray(data.facts)) return;
  observed.facts = data.facts.filter((f): f is Fact => !!f && typeof f.id === "string");
  checkHash();
  render();
});

/** The top-navigation probe only changes our hash; record it and tidy the URL. */
function checkHash() {
  const m = NAV_RE.exec(location.hash);
  if (!m) return;
  if (m[2] === nonce) observed.navigated.add(m[1] as "top-nav" | "top-nav-click");
  history.replaceState(null, "", `${location.pathname}${location.search}`);
}
window.addEventListener("hashchange", () => {
  checkHash();
  render();
});

// ---------- Report ----------

const STATUS_TEXT: Record<Finding["status"], string> = {
  fail: "Escaped",
  warn: "Open",
  pass: "Blocked",
  info: "Note",
  pending: "…",
  na: "n/a",
};

function render() {
  findings = judge(config, observed);
  const s = summarize(findings);
  ui.summary.dataset.tone = s.tone;
  ui.summaryTitle.textContent = s.title;
  ui.summaryBlurb.textContent = s.blurb;
  ui.counts.replaceChildren(
    ...([
      [s.fails, "escaped"],
      [s.warns, "open"],
      [s.passes, "blocked"],
    ] as const).map(([n, label]) => el("span", {}, el("b", {}, String(n)), ` ${label}`)),
  );

  ui.findings.replaceChildren(
    ...findings.map((f) => {
      const body = el("div", { className: "f-body" }, el("h3", {}, f.title), el("p", {}, f.detail));
      if (f.fix && (f.status === "fail" || f.status === "warn" || f.id === "messages")) body.append(el("p", { className: "fix" }, el("b", {}, "Fix: "), f.fix));
      const li = el("li", {}, el("span", { className: "pill" }, STATUS_TEXT[f.status]), body);
      li.dataset.status = f.status;
      return li;
    }),
  );
}

// ---------- Copying ----------

let toastTimer = 0;
function toast(msg: string) {
  ui.toast.textContent = msg;
  ui.toast.hidden = false;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (ui.toast.hidden = true), 2400);
}

async function copy(text: string, done: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast(done);
  } catch {
    // Clipboard blocked: hand the text over in a selectable box instead of a dialog.
    const area = el("textarea", { value: text, readOnly: true, className: "fallback", rows: 8 });
    ui.toast.replaceChildren("Copy this:", area);
    ui.toast.hidden = false;
    area.select();
  }
}

ui.copySnippet.addEventListener("click", () => copy(snippet(config), "Iframe snippet copied."));
ui.copyLink.addEventListener("click", () => copy(siteUrl(), "Link copied."));
ui.copyReport.addEventListener("click", () => copy(toMarkdown(config, findings, snippet(config), siteUrl()), "Report copied as Markdown."));
ui.copyProbe.addEventListener("click", () =>
  copy(
    buildDocument(null, probeOptions({ nonce: randomId(), mode: "standalone", kitOrigin: location.origin, topUrl: "", canary: "" })),
    "Probe HTML copied. Render it in your app's preview.",
  ),
);
ui.rerun.addEventListener("click", run);

// ---------- Start ----------

if (config.sandbox) rememberedTokens = [...config.sandbox];
buildControls();
history.replaceState(null, "", `?${encodeConfig(config)}`);
syncControls();
run();
