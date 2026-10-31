import "./style.css";
import { pikminDay } from "./countdown.ts";
import { paintGarden, render } from "./draw.ts";
import { World } from "./sim.ts";
import { BUILTIN_TYPES, decodePrompts, encodePrompts, inventType, type SproutType } from "./types.ts";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = $<HTMLCanvasElement>("lawn");
const g = canvas.getContext("2d")!;
const ui = {
  countdown: $("countdown"),
  stats: $("stats"),
  chips: $("chips"),
  form: $<HTMLFormElement>("invent"),
  prompt: $<HTMLInputElement>("prompt"),
  whistle: $<HTMLButtonElement>("whistle"),
  share: $<HTMLButtonElement>("share"),
  toast: $("toast"),
  help: $("help"),
};

let dpr = Math.min(2, window.devicePixelRatio || 1);
let world = new World(window.innerWidth, window.innerHeight, Date.now() % 100000);
let garden = paintGarden(world.width, world.height, dpr);
const types: SproutType[] = [...BUILTIN_TYPES];
const prompts: string[] = [];
let selected: string | undefined;

function fit() {
  dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = window.innerWidth, h = window.innerHeight;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  if (w !== world.width || h !== world.height) world.resize(w, h);
  garden = paintGarden(w, h, dpr);
}

// ---------- Starting squad ----------

function seed() {
  const [red, yellow, blue, purple, white] = BUILTIN_TYPES as [SproutType, SproutType, SproutType, SproutType, SproutType];
  world.spawnSprouts(red, 24, false);
  world.spawnSprouts(yellow, 10, false);
  world.spawnSprouts(blue, 10, false);
  world.spawnSprouts(purple, 4, false);
  world.spawnSprouts(white, 8, false);
  for (const s of world.sprouts) s.state = "follow";
}

// ---------- Inventing types ----------

function invent(prompt: string, announce = true) {
  const { type, count, traits } = inventType(prompt);
  if (!types.some((t) => t.id === type.id)) types.push(type);
  const existing = types.find((t) => t.id === type.id)!;
  world.spawnSprouts(existing, count);
  if (!prompts.includes(prompt)) prompts.push(prompt);
  history.replaceState(null, "", `#t=${encodePrompts(prompts)}`);
  if (announce) toast(`${count} ${existing.name} popped out of the onion: ${traits.length ? traits.join(", ") : "no special traits"}.`);
  renderChips();
}

ui.form.addEventListener("submit", (e) => {
  e.preventDefault();
  const p = ui.prompt.value.trim();
  if (!p) return;
  invent(p);
  ui.prompt.value = "";
  ui.prompt.blur();
});

// ---------- HUD ----------

let toastTimer: number | undefined;
function toast(text: string) {
  ui.toast.textContent = text;
  ui.toast.hidden = false;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (ui.toast.hidden = true), 3800);
}

function renderChips() {
  const counts = new Map<string, { follow: number; total: number }>();
  for (const s of world.sprouts) {
    const c = counts.get(s.type.id) ?? { follow: 0, total: 0 };
    c.total++;
    if (s.state === "follow") c.follow++;
    counts.set(s.type.id, c);
  }
  const all = { follow: world.followers().length, total: world.sprouts.length };
  const chip = (id: string | undefined, label: string, color: string, n: { follow: number; total: number }, title: string) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip";
    b.setAttribute("aria-pressed", String(selected === id));
    b.title = title;
    b.innerHTML = `<span class="dot" style="background:${color === "rainbow" ? "conic-gradient(red,orange,yellow,lime,cyan,blue,violet,red)" : color}"></span>${label}<span class="n">${n.follow}<span class="of">/${n.total}</span></span>`;
    b.addEventListener("click", () => {
      selected = id;
      renderChips();
    });
    return b;
  };
  ui.chips.replaceChildren(
    chip(undefined, "Any", "linear-gradient(135deg,#e5372c,#f5c518,#2f6fe0)", all, "Throw whoever's closest"),
    ...types
      .filter((t) => counts.has(t.id) || BUILTIN_TYPES.includes(t))
      .map((t, i) => chip(t.id, t.name, t.color, counts.get(t.id) ?? { follow: 0, total: 0 }, `${i + 1}: ${t.blurb}`)),
  );
}

function updateStats() {
  ui.stats.textContent = `${world.sprouts.length} sprouts · ${world.followers().length} following · ${world.delivered} delivered`;
  const day = pikminDay(new Date());
  ui.countdown.textContent = day.label;
  ui.countdown.classList.toggle("today", day.today);
}

// ---------- Input ----------

let lastTap = 0;
let lastTapX = 0;
let lastTapY = 0;
let down: { id: number; x: number; y: number; t: number; moved: boolean } | undefined;

function aim(x: number, y: number) {
  world.leader.aimX = x;
  world.leader.aimY = y;
}

function act(x: number, y: number) {
  const now = performance.now();
  const isDouble = now - lastTap < 320 && Math.hypot(x - lastTapX, y - lastTapY) < 40;
  lastTap = now;
  lastTapX = x;
  lastTapY = y;
  aim(x, y);
  if (isDouble) {
    const n = world.charge();
    if (n) toast(`Charge! ${n} sprouts rushing in.`);
    return;
  }
  if (!world.throwOne(selected) && selected && !world.throwOne()) toast("Nobody's following. Hold Whistle near some sprouts.");
  dismissHelp();
}

canvas.addEventListener("pointermove", (e) => {
  if (e.pointerType === "mouse" || down?.id === e.pointerId) aim(e.clientX, e.clientY);
  if (down && down.id === e.pointerId && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 12) down.moved = true;
});
canvas.addEventListener("pointerdown", (e) => {
  if (e.button === 2) {
    world.leader.whistling = true;
    return;
  }
  if (e.pointerType === "mouse") {
    act(e.clientX, e.clientY);
    return;
  }
  canvas.setPointerCapture(e.pointerId);
  down = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), moved: false };
  aim(e.clientX, e.clientY);
});
canvas.addEventListener("pointerup", (e) => {
  if (e.button === 2) {
    world.leader.whistling = false;
    return;
  }
  if (down && down.id === e.pointerId) {
    // Touch: a quick tap throws, a drag just leads.
    if (!down.moved && performance.now() - down.t < 300) act(e.clientX, e.clientY);
    else dismissHelp();
    down = undefined;
  }
});
canvas.addEventListener("pointercancel", () => (down = undefined));
canvas.addEventListener("contextmenu", (e) => e.preventDefault());

const holdWhistle = (on: boolean) => () => {
  world.leader.whistling = on;
  ui.whistle.classList.toggle("on", on);
};
ui.whistle.addEventListener("pointerdown", holdWhistle(true));
ui.whistle.addEventListener("pointerup", holdWhistle(false));
ui.whistle.addEventListener("pointerleave", holdWhistle(false));
ui.whistle.addEventListener("contextmenu", (e) => e.preventDefault());

window.addEventListener("keydown", (e) => {
  if (e.target instanceof HTMLInputElement) return;
  if (e.key === " ") { e.preventDefault(); holdWhistle(true)(); }
  if (e.key === "x" || e.key === "X") world.dismiss();
  if (e.key === "c" || e.key === "C") world.charge();
  if (e.key === "0") { selected = undefined; renderChips(); }
  const n = Number(e.key);
  if (n >= 1 && n <= 9 && types[n - 1]) { selected = types[n - 1]!.id; renderChips(); }
});
window.addEventListener("keyup", (e) => {
  if (e.key === " ") holdWhistle(false)();
});

function dismissHelp() {
  ui.help.classList.add("gone");
}

// ---------- Share ----------

ui.share.addEventListener("click", async () => {
  const url = location.href;
  const text = prompts.length
    ? `I invented ${prompts.length === 1 ? "a new sprout type" : `${prompts.length} sprout types`} for Pikmin Day. Lead the swarm:`
    : "Lead a swarm of sprouts for Pikmin Day:";
  try {
    if (navigator.share) await navigator.share({ title: "Pikmin Day Swarm", text, url });
    else {
      await navigator.clipboard.writeText(url);
      toast("Link copied. Your invented types come along with it.");
    }
  } catch {
    // Share sheet dismissed.
  }
});

// ---------- Loop ----------

let last = performance.now();
let hudClock = 0;
function frame(now: number) {
  const dt = (now - last) / 1000;
  last = now;
  world.update(dt);
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const range = selected ? types.find((t) => t.id === selected)?.throwRange ?? 1 : 1;
  render(g, world, garden, now / 1000, range);
  hudClock += dt;
  if (hudClock > 0.25) {
    hudClock = 0;
    updateStats();
    renderChips();
  }
  requestAnimationFrame(frame);
}

if (matchMedia("(pointer: coarse)").matches) {
  ui.help.innerHTML = "<p><b>Drag</b> to lead your sprouts. <b>Tap</b> to throw one. <b>Double-tap</b> to charge everyone.</p><p><b>Hold Whistle</b> to call sprouts back. Bring crumbs to the onion to grow the swarm. Only blue ones can wade into puddles.</p>";
}

window.addEventListener("resize", fit);
fit();
seed();
const shared = location.hash.startsWith("#t=") ? decodePrompts(location.hash.slice(3)) : [];
for (const p of shared) invent(p, false);
if (shared.length) toast(`A friend sent you ${shared.length === 1 ? "a sprout type" : `${shared.length} sprout types`}: ${shared.map((p) => inventType(p).type.name).join(", ")}.`);
renderChips();
updateStats();
(window as unknown as { __pds: unknown }).__pds = { get world() { return world; }, invent };
requestAnimationFrame(frame);
