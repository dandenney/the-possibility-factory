import "./style.css";
import {
  MS_PER_GAME_HOUR, RULES, STORAGE_KEY, advance, barrelName, canHaul, canLight, canMix, canPour, deserialize,
  formatDay, formatDuration, formatTime, haul, hint, isDone, light, mashTally, mix, newGame, pour, progress,
  serialize, type Result, type State,
} from "./sim.ts";
import { sceneSVG, updateScene } from "./scene.ts";
import { ledgerSVG, updateLedger } from "./ledger.ts";

const $ = <E extends HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<E>(sel)!;

let state: State = deserialize(localStorage.getItem(STORAGE_KEY)) ?? newGame();
let speed = 1;
const wrap = $("#scene-wrap");

const LOOKS = {
  painted: { svg: sceneSVG, update: updateScene, theme: "#2a1a12" },
  ledger: { svg: ledgerSVG, update: updateLedger, theme: "#f1e9d6" },
} as const;
type Look = keyof typeof LOOKS;
const LOOK_KEY = "dry-county:look";
const isLook = (v: string | null): v is Look => v === "painted" || v === "ledger";
let look: Look = (() => {
  const q = new URLSearchParams(location.search).get("look");
  if (isLook(q)) return q;
  try {
    const saved = localStorage.getItem(LOOK_KEY);
    if (isLook(saved)) return saved;
  } catch {
    /* no storage */
  }
  return "painted";
})();
let svg!: SVGSVGElement;

function mountLook(next: Look): void {
  look = next;
  wrap.innerHTML = LOOKS[look].svg();
  svg = wrap.querySelector("svg")!;
  document.documentElement.dataset.look = look;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", LOOKS[look].theme);
  for (const b of document.querySelectorAll<HTMLButtonElement>(".looks button")) {
    b.setAttribute("aria-checked", String(b.dataset.look === look));
  }
}

function setLook(next: Look): void {
  if (next === look) return;
  mountLook(next);
  try {
    localStorage.setItem(LOOK_KEY, next);
  } catch {
    /* no storage */
  }
  const url = new URL(location.href);
  url.searchParams.set("look", next);
  history.replaceState(null, "", url);
  render();
}

let shownTime = "";
/** Each digit gets a fixed-width cell so the clock doesn't shift as it ticks. */
function setTime(el: HTMLElement, text: string): void {
  if (text === shownTime) return;
  shownTime = text;
  el.innerHTML = [...text].map((c) => (/\d/.test(c) ? `<span class="dg">${c}</span>` : c === " " ? "&nbsp;" : c)).join("");
  el.setAttribute("aria-label", text);
}
mountLook(look);

type JobId = "barrel-0" | "barrel-1" | "still" | "water";
interface Action {
  label: string;
  check: Result;
  run: () => Result;
}

function barrelAction(i: number): Action | null {
  const b = state.barrels[i]!;
  if (b.status === "empty") return { label: "Mix mash", check: canMix(state, i), run: () => mix(state, i) };
  if (b.status === "ready") return { label: "Pour into still", check: canPour(state, i), run: () => pour(state, i) };
  return null;
}

function actionFor(id: string): Action | null {
  if (id === "barrel-0") return barrelAction(0);
  if (id === "barrel-1") return barrelAction(1);
  if (id === "still") {
    if (state.still.status === "running") return null;
    if (state.still.status === "loaded") return { label: "Light the fire", check: canLight(state), run: () => light(state) };
    const ready = state.barrels.findIndex((b) => b.status === "ready");
    if (ready >= 0) return { label: `Pour ${barrelName(ready)}`, check: canPour(state, ready), run: () => pour(state, ready) };
    return { label: "Light the fire", check: canLight(state), run: () => light(state) };
  }
  if (id === "water") return { label: "Haul water", check: canHaul(state), run: () => haul(state) };
  return null;
}

function jobStatus(id: JobId): [string, number | null] {
  if (id === "water") {
    if (state.haul) return [`Hauling, back in ${formatDuration(state.haul.until - state.clock)}`, progress(state.haul.from, state.haul.until, state.clock)];
    return [`${state.water} of ${RULES.waterCap} gal in the barrel`, null];
  }
  if (id === "still") {
    const s = state.still;
    if (s.status === "cold") return ["Cold. Needs ready mash", null];
    if (s.status === "loaded") return [`${RULES.mashGallons} gal of mash, fire's out`, null];
    return [`Running, ${s.jars} of ${RULES.jarsPerRun} jars, ${formatDuration(s.until - state.clock)} left`, progress(s.from, s.until, state.clock)];
  }
  const b = state.barrels[id === "barrel-0" ? 0 : 1]!;
  if (b.status === "empty") return ["Empty", null];
  if (b.status === "cooking") return [`Cooking, ${formatDuration(b.until - state.clock)}`, progress(b.from, b.until, state.clock)];
  if (b.status === "working") return [`Fermenting, ${formatDuration(b.until - state.clock)} left`, progress(b.from, b.until, state.clock)];
  return [`${RULES.mashGallons} gal of mash, ready`, 1];
}

let lastLogTop = "";
function render(): void {
  LOOKS[look].update(svg, state);
  $("#day").textContent = formatDay(state.clock);
  setTime($("#time"), formatTime(state.clock));
  $("#q-corn").textContent = String(state.corn);
  $("#q-sugar").textContent = String(state.sugar);
  $("#q-water").textContent = String(state.water);
  const m = mashTally(state);
  $("#q-mash").textContent = String(m.working + m.ready + m.inStill);
  $("#q-jars").textContent = String(state.jars);
  const parts = [m.working && `${m.working} working`, m.ready && `${m.ready} ready`, m.inStill && `${m.inStill} in the still`].filter(Boolean);
  $("#mash-note").textContent = parts.length ? `Mash: ${parts.join(", ")}.` : `A batch takes ${RULES.batch.corn} corn, ${RULES.batch.sugar} sugar and ${RULES.batch.water} gal of water.`;
  $("#next").textContent = hint(state);

  for (const li of document.querySelectorAll<HTMLLIElement>("#jobs li")) {
    const id = li.dataset.job as JobId;
    const [status, p] = jobStatus(id);
    $(".job-status", li).textContent = status;
    const meter = $(".meter", li);
    meter.hidden = p === null;
    $("span", meter).style.width = `${Math.round((p ?? 0) * 100)}%`;
    const btn = $<HTMLButtonElement>("button", li);
    const a = actionFor(id);
    btn.hidden = !a;
    if (a) {
      btn.textContent = a.label;
      btn.disabled = !a.check.ok;
      btn.title = a.check.ok ? "" : a.check.reason;
      li.classList.toggle("ready", a.check.ok);
    } else li.classList.remove("ready");
  }

  const top = state.log[0] ? `${state.log[0].at}:${state.log[0].text}` : "";
  if (top !== lastLogTop) {
    lastLogTop = top;
    $("#log").innerHTML = state.log
      .slice(0, 8)
      .map((e) => `<li><time>${formatTime(e.at)}</time><span>${escapeHtml(e.text)}</span></li>`)
      .join("");
  }

  const done = isDone(state);
  const fin = $("#finale");
  if (done && fin.hidden) {
    const days = Math.max(1, Math.round(state.clock / 60 / 24));
    $("#finale-body").textContent = `${state.jars} jars of corn liquor from ${RULES.start.corn} sacks of corn in ${days} ${days === 1 ? "day" : "days"}.`;
  }
  fin.hidden = !done;
  svg.classList.toggle("paused", speed === 0);
}

const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function save(): void {
  try {
    localStorage.setItem(STORAGE_KEY, serialize(state));
  } catch {
    /* private mode: play without saving */
  }
}

let toastTimer = 0;
function toast(text: string): void {
  const t = $("#toast");
  t.textContent = text;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (t.hidden = true), 2600);
}

function act(id: string): void {
  const a = actionFor(id);
  if (!a) {
    const [status] = id in { "barrel-0": 1, "barrel-1": 1, still: 1, water: 1 } ? jobStatus(id as JobId) : [describe(id)];
    toast(status);
    return;
  }
  const r = a.run();
  if (!r.ok) toast(r.reason);
  else {
    pulse(id);
    save();
  }
  render();
}

function describe(id: string): string {
  if (id === "pantry") return `${state.corn} sacks of corn and ${state.sugar} of sugar left.`;
  if (id === "shelf") return state.jars ? `${state.jars} jars of moonshine on the shelf.` : "The shelf is waiting on its first jar.";
  return "";
}

function pulse(id: string): void {
  const g = svg.querySelector(`[data-station="${id}"]`);
  if (!g) return;
  g.classList.remove("pulse");
  void (g as SVGGElement).getBBox();
  g.classList.add("pulse");
}

wrap.addEventListener("click", (e) => {
  const g = (e.target as Element).closest<SVGGElement>("[data-station]");
  if (g) act(g.dataset.station!);
});
wrap.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" && e.key !== " ") return;
  const g = (e.target as Element).closest<SVGGElement>("[data-station]");
  if (!g) return;
  e.preventDefault();
  act(g.dataset.station!);
});
for (const li of document.querySelectorAll<HTMLLIElement>("#jobs li")) {
  $("button", li).addEventListener("click", () => act(li.dataset.job!));
}

for (const b of document.querySelectorAll<HTMLButtonElement>(".looks button")) {
  b.addEventListener("click", () => setLook(b.dataset.look as Look));
}

function setSpeed(v: number): void {
  speed = v;
  for (const b of document.querySelectorAll<HTMLButtonElement>(".speeds button")) {
    b.setAttribute("aria-checked", String(Number(b.dataset.speed) === v));
  }
  render();
}
for (const b of document.querySelectorAll<HTMLButtonElement>(".speeds button")) {
  b.addEventListener("click", () => setSpeed(Number(b.dataset.speed)));
}
let resumeSpeed = 1;
document.addEventListener("keydown", (e) => {
  if (e.target instanceof HTMLButtonElement && (e.key === " " || e.key === "Enter")) return;
  if (e.key === "p" || e.key === "P") {
    if (speed) {
      resumeSpeed = speed;
      setSpeed(0);
    } else setSpeed(resumeSpeed);
  } else if (e.key === "1") setSpeed(1);
  else if (e.key === "2") setSpeed(6);
});

let armed = 0;
$("#reset").addEventListener("click", () => {
  const btn = $("#reset");
  if (!armed) {
    btn.textContent = "Click again to wipe this run";
    armed = window.setTimeout(() => {
      armed = 0;
      btn.textContent = "Start over";
    }, 3000);
    return;
  }
  clearTimeout(armed);
  armed = 0;
  btn.textContent = "Start over";
  restart();
});
$("#again").addEventListener("click", restart);

function restart(): void {
  state = newGame();
  lastLogTop = "";
  save();
  setSpeed(1);
}

let last = performance.now();
let saveAt = 0;
function frame(now: number): void {
  const dt = Math.min(250, now - last);
  last = now;
  if (speed && !isDone(state)) {
    advance(state, (dt / MS_PER_GAME_HOUR) * 60 * speed);
    if (now > saveAt) {
      save();
      saveAt = now + 2000;
    }
  }
  render();
  requestAnimationFrame(frame);
}
document.addEventListener("visibilitychange", () => {
  last = performance.now();
  if (document.hidden) save();
});

setSpeed(1);
requestAnimationFrame(frame);
