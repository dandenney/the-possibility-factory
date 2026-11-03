import "./style.css";
import { cardBlob, drawCard, scoreColor, type CardData } from "./card.ts";
import { detect, formatScore, RULE_BY_ID, RULES, segments, type Mark, type Result, type RuleId } from "./detect.ts";
import {
  cleanReply,
  DEFAULT_OLLAMA,
  DESLOP_MODEL,
  listModels,
  normalizeBase,
  paragraphs,
  pickModel,
  rewriteParagraph,
  splice,
  type Paragraph,
} from "./rewrite.ts";
import { SAMPLES } from "./samples.ts";
import { decodeScore, decodeText, describeShared, encodeScore, encodeText, MAX_TEXT_LINK } from "./share.ts";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const ui = {
  banner: $("banner"),
  samples: $("samples"),
  clear: $<HTMLButtonElement>("clear"),
  backdrop: $("backdrop"),
  text: $<HTMLTextAreaElement>("text"),
  score: $("score"),
  tier: $("tier"),
  blurb: $("blurb"),
  pin: $("scale-pin"),
  meta: $("meta"),
  legend: $("legend"),
  showAll: $<HTMLButtonElement>("show-all"),
  findings: $("findings"),
  includeText: $<HTMLInputElement>("include-text"),
  share: $<HTMLButtonElement>("share"),
  download: $<HTMLButtonElement>("download"),
  card: $<HTMLCanvasElement>("card"),
  rules: $("rules"),
  cmdPull: $("cmd-pull"),
  cmdServe: $("cmd-serve"),
  ollamaUrl: $<HTMLInputElement>("ollama-url"),
  connect: $<HTMLButtonElement>("connect"),
  status: $("ollama-status"),
  modelRow: $("model-row"),
  model: $<HTMLSelectElement>("model"),
  runRewrite: $<HTMLButtonElement>("run-rewrite"),
  rewriteOut: $("rewrite-out"),
  rewriteProgress: $("rewrite-progress"),
  rewriteScore: $("rewrite-score"),
  rewriteText: $("rewrite-text"),
  stopRewrite: $<HTMLButtonElement>("stop-rewrite"),
  useRewrite: $<HTMLButtonElement>("use-rewrite"),
  toast: $("toast"),
};

const SITE = `${location.origin}${location.pathname}`;
const DRAFT_KEY = "deslop:text";
const OLLAMA_KEY = "deslop:ollama";
const MIN_WORDS = 40;
const MAX_FINDINGS = 80;

let focus: RuleId | null = null;
let current: Result = detect("");

// ---------- Rendering ----------

function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> = {}, ...kids: (Node | string)[]) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...kids);
  return node;
}

function color(node: HTMLElement, c: string, c2?: string) {
  node.style.setProperty("--c", c);
  if (c2) node.style.setProperty("--c2", c2);
}

function drawMarks(target: HTMLElement, text: string, marks: Mark[]) {
  const frag = document.createDocumentFragment();
  for (const seg of segments(text, marks)) {
    if (!seg.rules.length) {
      frag.append(seg.text);
      continue;
    }
    const m = el("mark", {}, seg.text);
    color(m, RULE_BY_ID[seg.rules[0]!].color, seg.rules[1] && RULE_BY_ID[seg.rules[1]].color);
    if (seg.rules.length > 1) m.classList.add("stack");
    m.dataset.start = String(seg.start);
    frag.append(m);
  }
  if (text.endsWith("\n") || !text) frag.append("\u200b");
  target.replaceChildren(frag);
}

function autosize() {
  ui.text.style.height = "auto";
  ui.text.style.height = `${ui.text.scrollHeight}px`;
}

function excerpt(text: string, m: Mark): HTMLElement {
  const pad = 36;
  let a = Math.max(0, m.start - pad), b = Math.min(text.length, m.end + pad);
  const nlBefore = text.lastIndexOf("\n", m.start - 1);
  const nlAfter = text.indexOf("\n", m.end);
  if (nlBefore >= a) a = nlBefore + 1;
  if (nlAfter !== -1 && nlAfter < b) b = nlAfter;
  return el(
    "q",
    {},
    `${a > 0 && nlBefore < a - 1 ? "…" : ""}${text.slice(a, m.start)}`,
    el("b", {}, text.slice(m.start, m.end)),
    `${text.slice(m.end, b)}${b < text.length && text[b] !== "\n" ? "…" : ""}`,
  );
}

function render() {
  const text = ui.text.value;
  current = detect(text);
  const shown = focus ? current.marks.filter((m) => m.rule === focus) : current.marks;
  drawMarks(ui.backdrop, text, shown);
  autosize();

  const empty = current.words === 0;
  ui.score.textContent = formatScore(current.score);
  document.documentElement.style.setProperty("--score-color", empty ? "var(--ink)" : scoreColor(current.score));
  ui.tier.textContent = empty ? "Paste something" : current.tier.title;
  ui.blurb.textContent = empty
    ? "People who write carefully score under 15. A stock chatbot averages about 120."
    : current.tier.blurb;
  ui.pin.style.left = `${Math.min(100, current.score / 2)}%`;
  const tics = current.marks.length;
  ui.meta.textContent = empty
    ? ""
    : `${current.words.toLocaleString()} words, ${tics} ${tics === 1 ? "tic" : "tics"}, ${current.points} points.` +
      (current.words < MIN_WORDS ? " Short texts swing wildly; paste a paragraph or more for a fair score." : "");

  // legend
  const chips: HTMLElement[] = current.counts.map((c) => {
    const b = el("button", { type: "button" }, `${c.rule.label} `, el("b", {}, `×${c.count}`));
    color(b, c.rule.color);
    b.setAttribute("aria-pressed", String(focus === c.rule.id));
    b.title = c.rule.tip;
    b.addEventListener("click", () => setFocus(focus === c.rule.id ? null : c.rule.id));
    return b;
  });
  if (!chips.length) chips.push(el("p", { className: "none" }, empty ? "Nothing yet." : "No tics found. Nice."));
  ui.legend.replaceChildren(...chips);
  ui.legend.classList.toggle("focused", focus !== null);
  ui.showAll.hidden = focus === null;

  // findings
  const items = shown.slice(0, MAX_FINDINGS).map((m) => {
    const rule = RULE_BY_ID[m.rule];
    const b = el("button", { type: "button" }, excerpt(text, m), el("small", {}, el("b", {}, rule.label), ` · ${rule.tip}`));
    color(b, rule.color);
    b.addEventListener("click", () => jumpTo(m));
    return el("li", {}, b);
  });
  if (shown.length > MAX_FINDINGS) items.push(el("li", { className: "hint" }, `…and ${shown.length - MAX_FINDINGS} more.`));
  ui.findings.replaceChildren(...items);

  drawCard(ui.card, cardData());
  ui.runRewrite.disabled = !current.marks.length;
}

function cardData(): CardData {
  return {
    score: current.score,
    words: current.words,
    counts: current.counts.map((c) => [c.rule.id, c.count]),
    url: SITE,
  };
}

function setFocus(rule: RuleId | null) {
  if (focus !== null && rule === null && !current.counts.some((c) => c.rule.id === focus)) focus = null;
  focus = rule;
  render();
}

function jumpTo(m: Mark) {
  const mark = [...ui.backdrop.querySelectorAll<HTMLElement>("mark")].find((x) => Number(x.dataset.start) >= m.start);
  if (mark) {
    mark.scrollIntoView({ block: "center", behavior: "smooth" });
    mark.classList.remove("flash");
    void mark.offsetWidth;
    mark.classList.add("flash");
  }
  ui.text.focus({ preventScroll: true });
  ui.text.setSelectionRange(m.start, m.end);
}

let timer = 0;
function setText(text: string, save = true) {
  ui.text.value = text;
  if (save) saveDraft();
  render();
}

function saveDraft() {
  try {
    localStorage.setItem(DRAFT_KEY, ui.text.value);
  } catch {
    /* private mode */
  }
}

ui.text.addEventListener("input", () => {
  autosize();
  window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    saveDraft();
    render();
  }, 90);
});
window.addEventListener("resize", autosize);

for (const s of SAMPLES) {
  const b = el("button", { type: "button" }, s.label);
  b.addEventListener("click", () => {
    focus = null;
    setText(s.text);
  });
  ui.samples.append(b);
}
ui.clear.addEventListener("click", () => {
  focus = null;
  setText("");
  ui.text.focus();
});
ui.showAll.addEventListener("click", () => setFocus(null));

ui.rules.replaceChildren(
  ...RULES.map((r) => {
    const td = el("td", {}, r.label);
    color(td, r.color);
    return el("tr", {}, td, el("td", {}, String(r.weight)), el("td", {}, r.tip));
  }),
);

// ---------- Toast + sharing ----------

let toastTimer = 0;
function toast(msg: string) {
  ui.toast.textContent = msg;
  ui.toast.hidden = false;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (ui.toast.hidden = true), 2600);
}

async function shareUrl(): Promise<{ url: string; withText: boolean }> {
  let url = `${SITE}?${encodeScore(current)}`;
  if (ui.includeText.checked && ui.text.value.trim()) {
    const encoded = await encodeText(ui.text.value);
    if (encoded.length <= MAX_TEXT_LINK) return { url: `${url}#t=${encoded}`, withText: true };
    toast("That text is too long for a link; sharing the score only.");
  }
  return { url, withText: false };
}

ui.share.addEventListener("click", async () => {
  if (!current.words) {
    toast("Paste some text first.");
    ui.text.focus();
    return;
  }
  const { url, withText } = await shareUrl();
  const text = `My text scored ${formatScore(current.score)} slop per 1,000 words (${current.tier.title}) on the Deslop Detector.`;
  try {
    const blob = await cardBlob(ui.card);
    const file = blob && new File([blob], `slop-score-${Math.round(current.score)}.png`, { type: "image/png" });
    if (file && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], text: `${text} ${url}` });
      return;
    }
    if (navigator.share) {
      await navigator.share({ title: "Deslop Detector", text, url });
      return;
    }
    await navigator.clipboard.writeText(`${text} ${url}`);
    toast(withText ? "Link with your text copied." : "Link copied.");
  } catch (err) {
    if ((err as Error).name !== "AbortError") prompt("Copy this link:", url);
  }
});

ui.download.addEventListener("click", async () => {
  const blob = await cardBlob(ui.card);
  if (!blob) return;
  const a = el("a", { href: URL.createObjectURL(blob), download: `slop-score-${Math.round(current.score)}.png` });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});

// ---------- Ollama rewrite ----------

ui.cmdPull.textContent = `ollama pull ${DESLOP_MODEL}`;
ui.cmdServe.textContent = `OLLAMA_ORIGINS=${location.origin} ollama serve`;
for (const b of document.querySelectorAll<HTMLButtonElement>("button.copy")) {
  b.addEventListener("click", async () => {
    const code = $(b.dataset.copy!).textContent ?? "";
    try {
      await navigator.clipboard.writeText(code);
      toast("Copied.");
    } catch {
      prompt("Copy this:", code);
    }
  });
}

ui.ollamaUrl.value = localStorage.getItem(OLLAMA_KEY) ?? DEFAULT_OLLAMA;

function status(msg: string, kind: "" | "good" | "bad" = "") {
  ui.status.textContent = msg;
  ui.status.className = `status ${kind}`;
}

ui.connect.addEventListener("click", async () => {
  const base = normalizeBase(ui.ollamaUrl.value || DEFAULT_OLLAMA);
  ui.ollamaUrl.value = base;
  localStorage.setItem(OLLAMA_KEY, base);
  status("Connecting…");
  ui.connect.disabled = true;
  try {
    const models = await listModels(base);
    if (!models.length) {
      status("Ollama is running but has no models. Run the pull command above, then connect again.", "bad");
      ui.modelRow.hidden = true;
      return;
    }
    ui.model.replaceChildren(...models.map((m) => new Option(m, m)));
    ui.model.value = pickModel(models)!;
    ui.modelRow.hidden = false;
    const hasDeslop = models.some((m) => /deslop/i.test(m));
    status(
      hasDeslop
        ? "Connected. The de-slopped model is ready."
        : "Connected, but qwen3-4b-deslop isn't installed. Any model works; that one works best.",
      "good",
    );
  } catch {
    ui.modelRow.hidden = true;
    status(
      `Couldn't reach Ollama at ${base}. Check that it's running with OLLAMA_ORIGINS set to ${location.origin} (step 2), and that you allowed this site to reach your device if the browser asked.`,
      "bad",
    );
  } finally {
    ui.connect.disabled = false;
  }
});

let abort: AbortController | null = null;
let rewritten = "";

function drawRewrite(text: string, done: Paragraph[], outputs: Map<number, string>, working?: Paragraph) {
  const frag = document.createDocumentFragment();
  let cursor = 0;
  for (const p of paragraphs(text, [])) {
    frag.append(text.slice(cursor, p.start));
    const out = outputs.get(p.start);
    if (out !== undefined) frag.append(el("span", { className: working?.start === p.start ? "working" : "changed" }, out || "…"));
    else frag.append(p.text);
    cursor = p.end;
  }
  frag.append(text.slice(cursor));
  ui.rewriteText.replaceChildren(frag);
  void done;
}

ui.runRewrite.addEventListener("click", async () => {
  const source = ui.text.value;
  const base = normalizeBase(ui.ollamaUrl.value);
  const model = ui.model.value;
  const todo = paragraphs(source, current.marks).filter((p) => p.marks > 0);
  if (!todo.length) return;
  abort = new AbortController();
  const outputs = new Map<number, string>();
  const done: Paragraph[] = [];
  ui.rewriteOut.hidden = false;
  ui.useRewrite.hidden = true;
  ui.stopRewrite.hidden = false;
  ui.runRewrite.disabled = true;
  ui.rewriteScore.textContent = "";
  try {
    for (const [i, p] of todo.entries()) {
      ui.rewriteProgress.textContent = `Rewriting paragraph ${i + 1} of ${todo.length}…`;
      outputs.set(p.start, "");
      drawRewrite(source, done, outputs, p);
      const reply = await rewriteParagraph(
        base,
        model,
        p.text,
        (soFar) => {
          outputs.set(p.start, soFar);
          drawRewrite(source, done, outputs, p);
        },
        abort.signal,
      );
      outputs.set(p.start, cleanReply(reply) || p.text);
      done.push(p);
    }
    ui.rewriteProgress.textContent = `Rewrote ${todo.length} ${todo.length === 1 ? "paragraph" : "paragraphs"}.`;
  } catch (err) {
    const aborted = (err as Error).name === "AbortError";
    for (const p of todo) if (!done.includes(p)) outputs.delete(p.start);
    ui.rewriteProgress.textContent = aborted
      ? `Stopped after ${done.length} of ${todo.length}.`
      : `Rewrite failed: ${(err as Error).message}`;
  } finally {
    abort = null;
    ui.stopRewrite.hidden = true;
    ui.runRewrite.disabled = false;
  }
  drawRewrite(source, done, outputs);
  if (!done.length) return;
  rewritten = splice(source, done.map((p) => ({ start: p.start, end: p.end, text: outputs.get(p.start)! })));
  const after = detect(rewritten);
  ui.rewriteScore.textContent = `Score ${formatScore(current.score)} → ${formatScore(after.score)}`;
  ui.useRewrite.hidden = false;
});

ui.stopRewrite.addEventListener("click", () => abort?.abort());
ui.useRewrite.addEventListener("click", () => {
  focus = null;
  setText(rewritten);
  ui.useRewrite.hidden = true;
  ui.text.scrollIntoView({ behavior: "smooth", block: "start" });
  toast("Swapped in the rewrite.");
});

// ---------- Start ----------

async function start() {
  const shared = decodeScore(location.search);
  const fragment = new URLSearchParams(location.hash.slice(1)).get("t");
  const sharedText = fragment ? await decodeText(fragment) : undefined;
  if (sharedText !== undefined) {
    setText(sharedText, false);
    ui.banner.textContent = `Someone shared this text. It scores ${formatScore(current.score)} (${current.tier.title}). Edit it, or paste your own.`;
    ui.banner.hidden = false;
  } else {
    if (shared) {
      ui.banner.replaceChildren(
        "Someone's text scored ",
        el("b", {}, describeShared(shared)),
        `${shared.counts[0] ? `, mostly ${RULE_BY_ID[shared.counts[0][0]].label.toLowerCase()}` : ""}. How does yours compare? Paste it below.`,
      );
      ui.banner.hidden = false;
    }
    let draft = "";
    try {
      draft = localStorage.getItem(DRAFT_KEY) ?? "";
    } catch {
      /* private mode */
    }
    setText(draft || (shared ? "" : SAMPLES[0]!.text), false);
  }
}

start();
