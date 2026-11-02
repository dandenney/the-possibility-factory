import "./style.css";
import { cardBlob, drawCard, scoreColor } from "./card.ts";
import {
  computeGuilt,
  decodeShare,
  DEVICE_GB_OPTIONS,
  encodeShare,
  formatCount,
  formatGb,
  guessDeviceGb,
  MAX_TABS,
  TAB_WEIGHTS,
  type GuiltInput,
  type GuiltResult,
  type TabWeightId,
} from "./guilt.ts";
import { measurePageMb, probe } from "./probe.ts";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const ui = {
  banner: $("banner"),
  gauge: $("gauge"),
  score: $("score"),
  tier: $("tier"),
  quip: $("quip"),
  tabsRange: $<HTMLInputElement>("tabs-range"),
  tabs: $<HTMLInputElement>("tabs"),
  weights: $("weights"),
  device: $<HTMLSelectElement>("device"),
  deviceHint: $("device-hint"),
  evidence: $("evidence"),
  share: $<HTMLButtonElement>("share"),
  download: $<HTMLButtonElement>("download"),
  donate: $<HTMLButtonElement>("donate"),
  card: $<HTMLCanvasElement>("card"),
  dialog: $<HTMLDialogElement>("donation"),
  steps: $("donation-steps"),
  bar: $("donation-bar"),
  result: $("donation-result"),
  close: $<HTMLButtonElement>("donation-close"),
  toast: $("toast"),
};

const SITE = `${location.origin}${location.pathname}`;
const params = new URLSearchParams(location.search);
const shared = decodeShare(location.search);
const env = probe();
let measuredMb: number | undefined;
let donated = params.get("d") === "1";
let state: GuiltInput = shared ?? { tabs: 27, weight: "typical", deviceGb: guessDeviceGb(env.deviceMemory) };
let current: GuiltResult = computeGuilt(state);

// ---------- Controls ----------

for (const w of TAB_WEIGHTS) {
  const label = document.createElement("label");
  label.innerHTML = `<input type="radio" name="weight" value="${w.id}"><span>${w.label}</span>`;
  ui.weights.append(label);
}
for (const gb of DEVICE_GB_OPTIONS) ui.device.add(new Option(`${gb} GB`, String(gb)));

function syncControls() {
  ui.tabs.value = String(state.tabs);
  ui.tabsRange.value = String(Math.min(state.tabs, Number(ui.tabsRange.max)));
  ui.device.value = String(state.deviceGb);
  for (const input of ui.weights.querySelectorAll<HTMLInputElement>("input")) input.checked = input.value === state.weight;
}

function setState(patch: Partial<GuiltInput>) {
  state = { ...state, ...patch };
  render();
}

ui.tabsRange.addEventListener("input", () => setState({ tabs: Number(ui.tabsRange.value) }));
ui.tabs.addEventListener("input", () => {
  const n = Number(ui.tabs.value);
  if (n >= 1 && n <= MAX_TABS) {
    state = { ...state, tabs: Math.round(n) };
    ui.tabsRange.value = String(Math.min(state.tabs, Number(ui.tabsRange.max)));
    render(false);
  }
});
ui.tabs.addEventListener("change", () => render());
ui.weights.addEventListener("change", (e) => setState({ weight: (e.target as HTMLInputElement).value as TabWeightId }));
ui.device.addEventListener("change", () => setState({ deviceGb: Number(ui.device.value) }));

// ---------- Rendering ----------

function li(html: string) {
  const el = document.createElement("li");
  el.innerHTML = html;
  return el;
}

function deviceHint(): string {
  if (env.deviceMemory) {
    return env.deviceMemory >= 8
      ? `Your browser admits to at least 8 GB (it never says more than that), so pick the real number.`
      : `Your browser says about ${env.deviceMemory} GB.`;
  }
  return env.browser === "safari"
    ? "Safari won't say how much RAM you have. Very private. Very suspicious."
    : "Your browser won't say how much RAM you have, so be honest.";
}

function tabLine(): string {
  if (measuredMb) return `This tab alone is using <b>${formatCount(measuredMb)} MB</b> (measured by your browser). Yes, we're part of the problem.`;
  if (env.jsHeapMb) return `This tab's JavaScript alone is holding <b>${env.jsHeapMb.toFixed(1)} MB</b>. Yes, we're part of the problem.`;
  return "Your browser won't tell us how much memory this tab uses. We'll assume the worst.";
}

function render(updateInputs = true) {
  current = computeGuilt(state);
  state = current.input;
  if (updateInputs) syncControls();
  const r = current;
  const color = scoreColor(r.score);

  ui.gauge.style.setProperty("--score", String(r.score));
  document.documentElement.style.setProperty("--color", color);
  ui.score.textContent = String(r.score);
  ui.tier.textContent = r.tier.title;
  ui.quip.textContent = r.quip;
  ui.deviceHint.textContent = deviceHint();

  const pct = Math.round(r.shareOfDevice * 100);
  ui.evidence.replaceChildren(
    li(`Your ${r.input.tabs === 1 ? "tab is" : `${r.input.tabs} tabs are`} hoarding about <b>${formatGb(r.hoardedGb)}</b> of DRAM${pct > 100 ? `, more than your machine even has (hello, swap)` : pct >= 1 ? `, ${pct}% of your machine` : ""}.`),
    li(`In a data center that memory could hold <b>${formatCount(r.kvTokens)}</b> tokens of context for a 70B-class model.`),
    li(`That's <b>${formatCount(r.replies)}</b> chatbot replies that will never be written because of you.`),
    li(`Or roughly <b>${r.dramDies < 10 ? r.dramDies.toFixed(1) : formatCount(r.dramDies)}</b> DDR5 memory chips, just sitting there.`),
    li(tabLine()),
  );

  drawCard(ui.card, r, { url: SITE, donated });
}

// ---------- Sharing ----------

let toastTimer = 0;
function toast(text: string) {
  ui.toast.textContent = text;
  ui.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (ui.toast.hidden = true), 2600);
}

function shareUrl() {
  return `${SITE}?${encodeShare(state)}${donated ? "&d=1" : ""}`;
}

function shareText() {
  return donated
    ? `I donated my RAM to the data centers. RAM Guilt Meter: ${current.score}/100, "${current.tier.title}".`
    : `My browser tabs are hoarding ${formatGb(current.hoardedGb)} of Altman's DRAM. RAM Guilt Meter: ${current.score}/100, "${current.tier.title}".`;
}

ui.share.addEventListener("click", async () => {
  const url = shareUrl();
  const text = shareText();
  try {
    const blob = await cardBlob(ui.card);
    const file = blob && new File([blob], "ram-guilt-card.png", { type: "image/png" });
    if (file && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ title: "RAM Guilt Meter", text: `${text} ${url}`, files: [file] });
      return;
    }
    if (navigator.share) {
      await navigator.share({ title: "RAM Guilt Meter", text, url });
      return;
    }
    await navigator.clipboard.writeText(`${text} ${url}`);
    toast("Link copied. Spread the guilt.");
  } catch (err) {
    if ((err as Error).name !== "AbortError") prompt("Copy this link:", url);
  }
});

ui.download.addEventListener("click", async () => {
  const blob = await cardBlob(ui.card);
  if (!blob) return;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `ram-guilt-${current.score}.png`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});

// ---------- Donate your RAM ----------

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

ui.donate.addEventListener("click", async () => {
  const before = current;
  const steps = [
    `Gathering your ${before.input.tabs} ${before.input.tabs === 1 ? "tab" : "tabs"}…`,
    `Compressing ${formatGb(before.hoardedGb)} of “I'll read it later”…`,
    "Loading it onto a truck bound for a data center in Texas…",
    `Converting it into ${formatCount(before.kvTokens)} tokens of context…`,
    "Asking your browser to close your tabs…",
  ];
  ui.steps.replaceChildren(...steps.map((s) => li(s)));
  ui.bar.style.width = "0";
  ui.result.hidden = true;
  ui.close.hidden = true;
  ui.dialog.showModal();

  const items = [...ui.steps.children];
  for (const [i, item] of items.entries()) {
    await wait(i === items.length - 1 ? 900 : 650);
    item.classList.add("done");
    ui.bar.style.width = `${((i + 1) / items.length) * 100}%`;
  }

  window.close(); // Only works for windows a script opened, which this one wasn't.
  await wait(400);
  donated = true;
  setState({ tabs: 1 });
  ui.result.innerHTML = `Your browser refused to let us close your tabs. Close the other <b>${Math.max(0, before.input.tabs - 1)}</b> yourself; we've already updated your score.`;
  ui.result.hidden = false;
  ui.close.hidden = false;
  ui.close.focus();
});

ui.dialog.addEventListener("close", () => toast("Certified RAM donor. Share the card."));

// ---------- Start ----------

if (shared) {
  const theirs = computeGuilt(shared);
  ui.banner.innerHTML = `Someone ${donated ? "donated their RAM and " : ""}scored <b>${theirs.score}</b> (${theirs.tier.title}). Think you're less guilty? <button type="button" class="ghost" id="mine">Measure mine</button>`;
  ui.banner.hidden = false;
  $("mine").addEventListener("click", () => {
    donated = false;
    history.replaceState(null, "", location.pathname);
    ui.banner.hidden = true;
    setState({ tabs: 27, weight: "typical", deviceGb: guessDeviceGb(env.deviceMemory) });
    ui.tabs.focus();
    ui.tabs.select();
  });
}

render();

if (env.canMeasure) {
  measurePageMb().then((mb) => {
    if (mb) {
      measuredMb = mb;
      render(false);
    }
  });
}
