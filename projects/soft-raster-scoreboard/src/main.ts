import "./style.css";
import { evaluateBet, parseBet, type Bet } from "./bets.ts";
import { fetchGame, fetchScoreboard, type Game, type Play, type ScoreboardGame } from "./espn.ts";
import { featured } from "./featured.ts";
import { displayColor } from "./field.ts";
import { playDuration } from "./replay.ts";
import { Scene, type CameraMode } from "./scene.ts";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = $<HTMLCanvasElement>("screen");
const ctx = canvas.getContext("2d")!;
const ui = {
  featured: $("featured"),
  date: $<HTMLInputElement>("date"),
  games: $<HTMLSelectElement>("games"),
  bug: $("bug"),
  bugAway: $("bug-away"),
  bugHome: $("bug-home"),
  bugPeriod: $("bug-period"),
  bugClock: $("bug-clock"),
  bugDown: $("bug-down"),
  bet: $("bet"),
  stats: $("stats"),
  notice: $("notice"),
  prev: $<HTMLButtonElement>("prev"),
  play: $<HTMLButtonElement>("play"),
  next: $<HTMLButtonElement>("next"),
  scrub: $<HTMLInputElement>("scrub"),
  count: $("count"),
  live: $<HTMLButtonElement>("live"),
  speed: $<HTMLSelectElement>("speed"),
  camera: $<HTMLSelectElement>("camera"),
  res: $<HTMLSelectElement>("res"),
  ticker: $("ticker"),
  wp: document.getElementById("wp") as unknown as SVGSVGElement,
  wpLabel: $("wp-label"),
  wpLegend: $("wp-legend"),
};

const TZ = "America/Chicago";
const todayKey = () => new Date().toLocaleDateString("en-CA", { timeZone: TZ });

const state = {
  game: undefined as Game | undefined,
  bet: undefined as Bet | undefined,
  index: 0,
  t: 0,
  hold: 0,
  playing: true,
  following: false,
  speed: 4,
  camera: "broadcast" as CameraMode,
  loadToken: 0,
  frameMs: 0,
};

let scene = makeScene(480);

function makeScene(width: number): Scene {
  const height = Math.round((width * 9) / 16);
  canvas.width = width;
  canvas.height = height;
  const s = new Scene(ctx, width, height);
  if (state.game) s.setGame(state.game);
  return s;
}

// ---------- URL state ----------

function readUrl() {
  const params = new URLSearchParams(location.search);
  return { event: params.get("event"), bet: params.get("bet"), date: params.get("date"), cam: params.get("cam") };
}

function writeUrl(event: string, bet?: Bet) {
  const params = new URLSearchParams();
  params.set("event", event);
  if (bet) params.set("bet", bet.label);
  if (state.camera !== "broadcast") params.set("cam", state.camera);
  history.replaceState(null, "", `?${params}`);
}

// ---------- Loading ----------

let pollTimer: number | undefined;

async function loadGame(event: string, bet?: Bet) {
  const token = ++state.loadToken;
  window.clearTimeout(pollTimer);
  ui.notice.hidden = false;
  ui.notice.innerHTML = "Loading play-by-play…";
  try {
    const game = await fetchGame(event);
    if (token !== state.loadToken) return;
    state.bet = bet;
    state.game = game;
    state.index = 0;
    state.t = 0;
    state.hold = 0;
    state.playing = game.plays.length > 0;
    state.following = false;
    scene.setGame(game);
    writeUrl(event, bet);
    ui.games.value = event;
    renderFeatured();
    onGameUpdated();
    schedulePoll(event, token);
  } catch (err) {
    if (token !== state.loadToken) return;
    ui.notice.hidden = false;
    ui.notice.innerHTML = `Couldn't load that game.<small>${(err as Error).message}</small>`;
  }
}

function schedulePoll(event: string, token: number) {
  const game = state.game;
  if (!game || game.state === "post") return;
  const delay = game.state === "in" ? 20_000 : 60_000;
  pollTimer = window.setTimeout(async () => {
    if (token !== state.loadToken) return;
    try {
      const fresh = await fetchGame(event);
      if (token !== state.loadToken) return;
      const atEnd = state.index >= (state.game?.plays.length ?? 1) - 1 && state.t >= 1;
      state.game = fresh;
      scene.setGame(fresh);
      if (state.following && atEnd && fresh.plays.length > 0) {
        state.playing = true;
      }
      onGameUpdated();
      refreshScoreboard(false);
    } catch {
      // Keep the last good data; try again next tick.
    }
    schedulePoll(event, token);
  }, delay);
}

let scoreboard: ScoreboardGame[] = [];

async function refreshScoreboard(rebuild = true) {
  const date = ui.date.value.replaceAll("-", "");
  try {
    scoreboard = await fetchScoreboard(date);
  } catch {
    scoreboard = [];
  }
  if (rebuild) {
    ui.games.replaceChildren(
      ...(scoreboard.length
        ? scoreboard.map((g) => {
            const o = document.createElement("option");
            o.value = g.id;
            const score = g.state === "pre" ? "" : ` · ${g.away.abbr} ${g.away.score}, ${g.home.abbr} ${g.home.score}`;
            o.textContent = `${g.state === "in" ? "● " : ""}${g.shortName}${score} · ${g.detail}`;
            return o;
          })
        : [new Option("No FBS games on this date", "")]),
    );
    if (state.game) ui.games.value = state.game.id;
  }
  renderFeatured();
}

// ---------- Featured bets ----------

function renderFeatured() {
  ui.featured.replaceChildren(
    ...featured.map((f) => {
      const bet = parseBet(f.bet)!;
      const sb = scoreboard.find((g) => g.id === f.event);
      const live = state.game?.id === f.event ? state.game : undefined;
      const score = live
        ? { homeAbbr: live.home.abbr, awayAbbr: live.away.abbr, homeScore: live.homeScore, awayScore: live.awayScore, state: live.state }
        : sb
          ? { homeAbbr: sb.home.abbr, awayAbbr: sb.away.abbr, homeScore: sb.home.score, awayScore: sb.away.score, state: sb.state }
          : undefined;
      const result = score ? evaluateBet(bet, score) : undefined;
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chip";
      b.setAttribute("aria-pressed", String(state.game?.id === f.event));
      const scoreText = score && score.state !== "pre" ? `${score.awayAbbr} ${score.awayScore} – ${score.homeAbbr} ${score.homeScore}` : sb?.detail ?? "";
      b.innerHTML = `<span class="k">Our bet · ${f.matchup}</span><span class="bet-name">${bet.label} <span class="line">${f.odds}</span></span><span class="line ${result?.status ?? ""}">${[scoreText, result ? betLine(result, bet) : ""].filter(Boolean).join(" · ")}</span>`;
      b.addEventListener("click", () => loadGame(f.event, bet));
      return b;
    }),
  );
}

function betLine(r: NonNullable<ReturnType<typeof evaluateBet>>, bet: Bet): string {
  const pts = Math.abs(r.margin);
  switch (r.status) {
    case "pending": return "not started";
    case "push": return bet.kind === "ml" ? "tied" : "on the number";
    case "winning": return `covering by ${pts}`;
    case "losing": return `short by ${pts}`;
    case "won": return `cashed by ${pts}`;
    case "lost": return `lost by ${pts}`;
  }
}

// ---------- HUD ----------

function shownPlay(): { play?: Play; after: boolean } {
  const plays = state.game?.plays ?? [];
  const play = plays[state.index];
  return { play, after: state.t >= 1 };
}

let hudKey = "";

function updateHud() {
  const game = state.game;
  if (!game) return;
  const { play, after } = shownPlay();
  const prev = game.plays[state.index - 1];
  const scoreSrc = after ? play : prev;
  const homeScore = scoreSrc?.homeScore ?? 0;
  const awayScore = scoreSrc?.awayScore ?? 0;
  const key = `${game.id}:${state.index}:${after}:${homeScore}:${awayScore}:${game.plays.length}:${state.following}:${game.state}`;
  if (key === hudKey) return;
  hudKey = key;

  ui.bug.hidden = false;
  const paint = (el: HTMLElement, team: Game["home"], score: number, hasBall: boolean) => {
    el.style.background = `#${team.color}`;
    el.querySelector(".abbr")!.textContent = team.abbr;
    el.querySelector(".score")!.textContent = String(score);
    el.classList.toggle("has-ball", hasBall);
  };
  paint(ui.bugAway, game.away, awayScore, play?.offense === "away");
  paint(ui.bugHome, game.home, homeScore, play?.offense === "home");
  const ordinal = (n: number) => (n <= 4 ? ["1st", "2nd", "3rd", "4th"][n - 1] : `OT${n - 4 > 1 ? n - 4 : ""}`);
  ui.bugPeriod.textContent = play ? ordinal(play.period)! : game.state === "pre" ? "PRE" : "";
  ui.bugClock.textContent = play?.clock ?? "";
  ui.bugDown.textContent = (after ? play?.downText : prev?.downText) ?? "";

  if (state.bet) {
    const r = evaluateBet(state.bet, {
      homeAbbr: game.home.abbr,
      awayAbbr: game.away.abbr,
      homeScore,
      awayScore,
      state: state.index >= game.plays.length - 1 && after ? game.state : game.plays.length ? "in" : game.state,
    });
    ui.bet.hidden = !r;
    if (r) {
      ui.bet.className = `bet ${r.status}`;
      ui.bet.textContent = `${state.bet.label} · ${betLine(r, state.bet)}`;
    }
  } else {
    ui.bet.hidden = true;
  }

  if (play) {
    const flag = play.scoring ? `<span class="score-flag">${play.type.toUpperCase()} · </span>` : "";
    ui.ticker.innerHTML = `<span class="meta">${ordinal(play.period)} ${play.clock} · ${play.type}</span>${flag}${escapeHtml(play.text)}`;
  } else {
    ui.ticker.textContent = game.state === "pre" ? "No plays yet." : "";
  }

  ui.scrub.max = String(Math.max(0, game.plays.length - 1));
  ui.scrub.value = String(state.index);
  ui.count.textContent = `${game.plays.length ? state.index + 1 : 0} / ${game.plays.length}`;
  ui.live.hidden = game.state !== "in";
  ui.live.setAttribute("aria-pressed", String(state.following));
  ui.play.textContent = state.playing ? "❚❚" : "▶";
  ui.play.setAttribute("aria-label", state.playing ? "Pause" : "Play");

  drawWinProbability(game);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

function drawWinProbability(game: Game) {
  const pts = game.plays.map((p, i) => [i, p.homeWinPct] as const).filter((p): p is readonly [number, number] => p[1] != null);
  const n = Math.max(1, game.plays.length - 1);
  const x = (i: number) => (i / n) * 1000;
  const y = (pct: number) => 6 + (1 - pct) * 108;
  const home = `#${toHex(displayColor(game.home))}`;
  const away = `#${toHex(displayColor(game.away))}`;
  const line = pts.map(([i, p]) => `${x(i).toFixed(1)},${y(p).toFixed(1)}`).join(" ");
  const cur = game.plays[state.index]?.homeWinPct;
  ui.wp.innerHTML = `
    <line x1="0" x2="1000" y1="60" y2="60" stroke="#ffffff22" stroke-dasharray="6 6" />
    ${line ? `<polyline points="${line}" fill="none" stroke="url(#wpg)" stroke-width="3" vector-effect="non-scaling-stroke" />` : ""}
    <defs><linearGradient id="wpg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${home}"/><stop offset="0.5" stop-color="#ffffff"/><stop offset="1" stop-color="${away}"/></linearGradient></defs>
    <line x1="${x(state.index)}" x2="${x(state.index)}" y1="0" y2="120" stroke="#ffb400" stroke-width="2" vector-effect="non-scaling-stroke" />`;
  ui.wpLabel.textContent = cur != null ? `Win probability · ${cur >= 0.5 ? game.home.abbr : game.away.abbr} ${Math.round(Math.max(cur, 1 - cur) * 100)}%` : "Win probability";
  ui.wpLegend.innerHTML = `<span style="color:${home}">▲ ${game.home.abbr}</span> &nbsp; <span style="color:${away}">▼ ${game.away.abbr}</span>`;
}

const toHex = (c: [number, number, number]) => c.map((v) => v.toString(16).padStart(2, "0")).join("");

function onGameUpdated() {
  const game = state.game!;
  hudKey = "";
  if (game.plays.length === 0) {
    ui.notice.hidden = false;
    const kickoff = new Date(game.date).toLocaleTimeString("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" });
    ui.notice.innerHTML = `${game.away.shortName} @ ${game.home.shortName}<small>${game.state === "pre" ? `Kickoff ${kickoff} CT. This page checks for plays every minute.` : game.detail}</small>`;
  } else {
    ui.notice.hidden = true;
  }
  if (state.following) {
    state.index = Math.min(state.index, game.plays.length - 1);
  }
  updateHud();
}

// ---------- Playback ----------

function seek(index: number, t = 1) {
  const n = state.game?.plays.length ?? 0;
  state.index = Math.max(0, Math.min(n - 1, index));
  state.t = t;
  state.hold = 0;
  updateHud();
}

function step(dt: number) {
  const game = state.game;
  if (!game || !state.playing || game.plays.length === 0) return;
  const play = game.plays[state.index]!;
  if (state.t < 1) {
    state.t = Math.min(1, state.t + (dt * state.speed) / playDuration(play));
    return;
  }
  state.hold += dt * state.speed;
  if (state.hold < 0.6) return;
  if (state.index < game.plays.length - 1) {
    state.index++;
    state.t = 0;
    state.hold = 0;
  } else if (!state.following) {
    state.playing = false;
    hudKey = "";
  }
}

let last = performance.now();
function frame(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  step(dt);
  const t0 = performance.now();
  scene.render({ index: state.index, t: state.t, camera: state.camera, time: now / 1000 });
  const ms = performance.now() - t0;
  state.frameMs = state.frameMs * 0.9 + ms * 0.1;
  const { triangles, pixels } = scene.fb.stats;
  ui.stats.textContent = `CPU raster ${scene.fb.width}×${scene.fb.height}\n${state.frameMs.toFixed(1)} ms/frame · ${triangles} tris · ${(pixels / 1000).toFixed(0)}k px`;
  updateHud();
  requestAnimationFrame(frame);
}

// ---------- Wiring ----------

ui.play.addEventListener("click", () => {
  const game = state.game;
  if (!game) return;
  if (!state.playing && state.index >= game.plays.length - 1 && state.t >= 1) seek(0, 0);
  state.playing = !state.playing;
  hudKey = "";
});
ui.prev.addEventListener("click", () => { state.following = false; seek(state.index - 1, 0); });
ui.next.addEventListener("click", () => { state.following = false; seek(state.index + 1, 0); });
ui.scrub.addEventListener("input", () => { state.following = false; seek(Number(ui.scrub.value)); });
ui.live.addEventListener("click", () => {
  state.following = !state.following;
  if (state.following && state.game) {
    seek(state.game.plays.length - 1, 0);
    state.playing = true;
  }
  hudKey = "";
});
ui.speed.addEventListener("change", () => (state.speed = Number(ui.speed.value)));
ui.camera.addEventListener("change", () => {
  state.camera = ui.camera.value as CameraMode;
  if (state.game) writeUrl(state.game.id, state.bet);
});
ui.res.addEventListener("change", () => (scene = makeScene(Number(ui.res.value))));
ui.games.addEventListener("change", () => {
  const id = ui.games.value;
  if (!id) return;
  const f = featured.find((x) => x.event === id);
  loadGame(id, f ? parseBet(f.bet) : undefined);
});
ui.date.addEventListener("change", () => refreshScoreboard());
ui.wp.addEventListener("click", (e) => {
  const n = state.game?.plays.length ?? 0;
  const rect = ui.wp.getBoundingClientRect();
  state.following = false;
  seek(Math.round(((e.clientX - rect.left) / rect.width) * (n - 1)));
});
window.addEventListener("keydown", (e) => {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
  if (e.key === " ") { e.preventDefault(); ui.play.click(); }
  if (e.key === "ArrowLeft") ui.prev.click();
  if (e.key === "ArrowRight") ui.next.click();
});

// ---------- Boot ----------

const initial = readUrl();
ui.date.value = initial.date ?? todayKey();
if (initial.cam === "blimp" || initial.cam === "endzone") ui.camera.value = state.camera = initial.cam;
renderFeatured();
refreshScoreboard();
const firstEvent = initial.event ?? featured[0]?.event;
if (firstEvent) {
  const f = featured.find((x) => x.event === firstEvent);
  loadGame(firstEvent, parseBet(initial.bet) ?? (f ? parseBet(f.bet) : undefined));
}
(window as unknown as { __srs: unknown }).__srs = { state, seek };
requestAnimationFrame(frame);
