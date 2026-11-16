import "./style.css";
import { calloutFor, clock, headline, lineFor } from "./callouts.ts";
import { Fx, render, viewFor } from "./draw.ts";
import { Recorder } from "./replay.ts";
import { challengeUrl, parseChallenge, randomFlight, shareText } from "./share.ts";
import { ARMS_Y, FUEL_SECONDS, World, windKnots, type FlightEvent, type Outcome } from "./sim.ts";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = $<HTMLCanvasElement>("sky");
const g = canvas.getContext("2d")!;
const stage = $("stage");
const ui = {
  cue: $("cue"),
  result: $("result"),
  headline: $("headline"),
  numbers: $("numbers"),
  quote: $("quote"),
  retry: $<HTMLButtonElement>("retry"),
  next: $<HTMLButtonElement>("next"),
  share: $<HTMLButtonElement>("share"),
  copy: $<HTMLButtonElement>("copy"),
  toast: $("toast"),
  challenge: $("challenge"),
  log: $("log"),
  alt: $("t-alt"),
  vs: $("t-vs"),
  off: $("t-off"),
  wind: $("t-wind"),
  fuel: $("t-fuel"),
  gauge: $("t-gauge"),
  flightNo: $("flight-no"),
  best: $("best"),
};

const DT = 1 / 120;
const challenge = parseChallenge(location.search);
let flight = challenge.flight ?? randomFlight();
let world = new World(flight);
let fx = new Fx();
let recorder = new Recorder(flight);
let gif: Blob | undefined;
let pressed = false;
let latched = false;
let shown = false;
let since = 0;
let acc = 0;
let last = performance.now();
let lastHud = 0;

// ---------- Layout ----------

let dpr = 1;
function fit() {
  dpr = Math.min(2, window.devicePixelRatio || 1);
  const r = stage.getBoundingClientRect();
  canvas.width = Math.round(r.width * dpr);
  canvas.height = Math.round(r.height * dpr);
}
new ResizeObserver(fit).observe(stage);
fit();

// ---------- Flights ----------

function bestKey(f: number) {
  return `chopsticks-best-${f}`;
}
function bestFor(f: number): number {
  return Number(localStorage.getItem(bestKey(f)) ?? 0);
}

function start(f: number) {
  flight = f;
  world = new World(f);
  fx = new Fx();
  recorder = new Recorder(f);
  gif = undefined;
  shown = false;
  since = 0;
  ui.result.hidden = true;
  ui.result.classList.remove("won");
  ui.share.disabled = true;
  ui.share.textContent = "Making replay…";
  ui.log.replaceChildren();
  log(lineFor("ready", f), 0);
  ui.flightNo.textContent = `Flight ${f}`;
  const best = bestFor(f);
  ui.best.textContent = best ? `your best ${best}` : "no catch yet";
  const url = new URL(location.href);
  url.searchParams.set("f", String(f));
  if (f !== challenge.flight) url.searchParams.delete("s");
  history.replaceState(null, "", url);
  if (challenge.score && f === challenge.flight) {
    ui.challenge.innerHTML = `Someone caught this flight for <strong>${challenge.score}</strong> points. Beat it.`;
    ui.challenge.hidden = false;
  } else ui.challenge.hidden = true;
}

function log(text: string, t: number, cls = "") {
  if (!text) return;
  const li = document.createElement("li");
  if (cls) li.className = cls;
  const time = document.createElement("time");
  time.textContent = clock(t);
  li.append(time, text);
  ui.log.append(li);
  while (ui.log.children.length > 7) ui.log.firstElementChild!.remove();
}

function onEvent(e: FlightEvent) {
  const won = e.type === "outcome" && e.outcome.kind === "caught";
  log(calloutFor(e, flight), world.t, won ? "win" : "");
  if (e.type !== "outcome") return;
  if (e.outcome.kind === "caught") {
    fx.caught();
    if (e.outcome.score > bestFor(flight)) localStorage.setItem(bestKey(flight), String(e.outcome.score));
  } else if (world.impact) {
    fx.explode(world.impact.x, world.impact.y);
  }
  navigator.vibrate?.(e.outcome.kind === "caught" ? 40 : [60, 40, 120]);
}

function numbers(o: Outcome): string {
  const speed = `${o.speed.toFixed(1)} m/s`;
  const off = `${o.offset.toFixed(1)} m off center`;
  if (o.kind === "caught") return `${o.score} points · ${speed} at the arms · ${off}`;
  if (o.reason === "tower" || o.reason === "mount" || o.reason === "ground") return `Impact at ${speed}`;
  return `${speed} · ${off}`;
}

function showResult(o: Outcome) {
  shown = true;
  const e = { type: "outcome", outcome: o } as const;
  ui.headline.textContent = headline(e);
  ui.numbers.textContent = numbers(o);
  ui.quote.textContent = o.kind === "caught" ? `${Math.round(o.fuelLeft * 100)}% propellant left.` : tip(o);
  ui.result.classList.toggle("won", o.kind === "caught");
  ui.result.hidden = false;
  ui.retry.focus({ preventScroll: true });
}

function tip(o: Outcome & { kind: "crashed" }): string {
  switch (o.reason) {
    case "hot": return "Burn until it nearly stops, then let go.";
    case "slipped": return "Let go a little sooner, while the pins are still above the arms.";
    case "air": return "Wait until the pins drop into the catch window.";
    case "missed": case "tower": return "Burn earlier. The engines steer you back to center.";
    case "mount": return world.burned ? "Let go inside the catch window to close the arms." : "Hold to burn on the way down. It slows you and steers you to the arms.";
    case "ground": return !world.burned ? "Hold to burn on the way down. It slows you and steers you to the arms." : "Burn sooner and in taps. The engines steer while they fire.";
  }
}

async function makeGif(o: Outcome) {
  const title = headline({ type: "outcome", outcome: o });
  const lines = o.kind === "caught"
    ? [`${o.score} points`, `${o.speed.toFixed(1)} m/s at the arms`, `${o.offset.toFixed(1)} m off center`]
    : [numbers(o)];
  const forFlight = flight;
  const blob = await recorder.encode(title, lines);
  if (forFlight !== flight) return;
  gif = blob;
  ui.share.disabled = false;
  ui.share.textContent = "Share replay GIF";
}

// ---------- Sharing ----------

function toast(text: string) {
  ui.toast.textContent = text;
  ui.toast.hidden = false;
  clearTimeout((toast as unknown as { t?: number }).t);
  (toast as unknown as { t?: number }).t = window.setTimeout(() => (ui.toast.hidden = true), 2200);
}

async function copyLink() {
  const url = challengeUrl(flight, world.outcome);
  try {
    await navigator.clipboard.writeText(url);
    toast("Challenge link copied");
  } catch {
    prompt("Copy this link", url);
  }
}

async function shareReplay() {
  if (!gif || !world.outcome) return;
  const url = challengeUrl(flight, world.outcome);
  const text = shareText(flight, world.outcome);
  const file = new File([gif], `chopsticks-catch-${flight}.gif`, { type: "image/gif" });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text: `${text} ${url}` });
      return;
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
    }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(gif);
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  try {
    await navigator.clipboard.writeText(`${text} ${url}`);
    toast("GIF saved, link copied");
  } catch {
    toast("GIF saved");
  }
}

ui.retry.addEventListener("click", () => start(flight));
ui.next.addEventListener("click", () => start(randomFlight()));
ui.copy.addEventListener("click", copyLink);
ui.share.addEventListener("click", shareReplay);

// ---------- Input ----------

stage.addEventListener("pointerdown", (e) => {
  if ((e.target as HTMLElement).closest(".result")) return;
  if (world.done) return;
  e.preventDefault();
  stage.setPointerCapture(e.pointerId);
  pressed = latched = true;
});
const up = () => (pressed = false);
stage.addEventListener("pointerup", up);
stage.addEventListener("pointercancel", up);
stage.addEventListener("contextmenu", (e) => e.preventDefault());

const HOLD_KEYS = new Set([" ", "ArrowUp", "w", "W"]);
window.addEventListener("keydown", (e) => {
  if (!HOLD_KEYS.has(e.key)) {
    if ((e.key === "r" || e.key === "R") && world.done) start(flight);
    return;
  }
  if (world.done) {
    if (shown && e.key === " " && !(e.target as HTMLElement).closest("button")) {
      e.preventDefault();
      start(flight);
    }
    return;
  }
  e.preventDefault();
  if (!e.repeat) latched = true;
  pressed = true;
});
window.addEventListener("keyup", (e) => {
  if (HOLD_KEYS.has(e.key)) pressed = false;
});
window.addEventListener("blur", up);

// ---------- HUD ----------

function cue() {
  const w = world;
  let text = "";
  let go = false;
  const touch = matchMedia("(pointer: coarse)").matches;
  if (w.phase === "ready") text = touch ? "Tap to start the descent" : "Press Space or click to start the descent";
  else if (w.phase === "flying" && w.inWindow) {
    text = pressed ? "Let go to catch" : "Tap and let go to catch";
    go = true;
  } else if (w.phase === "flying" && !w.burned) text = touch ? "Hold anywhere to burn" : "Hold Space or the mouse to burn";
  else if (w.phase === "flying" && w.fuel === 0) text = "Out of propellant";
  if (ui.cue.textContent !== text) ui.cue.textContent = text;
  ui.cue.classList.toggle("go", go);
}

function hud() {
  const w = world;
  const h = w.y - ARMS_Y;
  ui.alt.textContent = w.phase === "crashed" ? "–" : `${h.toFixed(0)} m`;
  const down = Math.max(0, -w.vy);
  ui.vs.textContent = `${down.toFixed(down >= 20 ? 0 : 1)} m/s`;
  ui.vs.classList.toggle("hot", h < 60 && -w.vy > 15);
  ui.off.textContent = `${Math.abs(w.offset).toFixed(1)} m`;
  const kt = windKnots(w.wind);
  ui.wind.textContent = kt === 0 ? "calm" : `${kt} kt ${w.wind > 0 ? "→" : "←"}`;
  const f = w.fuel / FUEL_SECONDS;
  ui.fuel.textContent = `${Math.round(f * 100)}%`;
  ui.gauge.style.width = `${f * 100}%`;
  ui.gauge.classList.toggle("low", f <= 0.25);
  cue();
}

// ---------- Loop ----------

function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  acc += dt;
  while (acc >= DT) {
    world.step(DT, pressed || latched);
    latched = false;
    for (const e of world.drain()) onEvent(e);
    acc -= DT;
  }
  const v = viewFor(world, canvas.width / dpr, canvas.height / dpr);
  fx.update(dt, world, v);
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  render(g, world, fx, v, now / 1000);
  if (recorder.tick(dt, world, fx, now / 1000) && world.outcome && !gif && ui.share.disabled) {
    ui.share.textContent = "Making replay…";
    void makeGif(world.outcome);
  }
  if (world.done && !shown) {
    since += dt;
    if (since > 1.1) showResult(world.outcome!);
  }
  if (now - lastHud > 50) {
    lastHud = now;
    hud();
  }
  requestAnimationFrame(frame);
}

start(flight);
document.fonts?.ready.then(() => fit());
requestAnimationFrame(frame);
