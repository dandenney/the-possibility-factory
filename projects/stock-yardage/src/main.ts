import "@fontsource/ibm-plex-mono/latin-400.css";
import "@fontsource/ibm-plex-mono/latin-500.css";
import "@fontsource/space-grotesk/latin-500.css";
import "@fontsource/space-grotesk/latin-700.css";
import "./style.css";

import {
  GOOD_SHOTS,
  PRESETS,
  loftOf,
  SITE_CLUBS,
  VENUES,
  VENUE_HINT,
  VENUE_LABEL,
  newId,
  parseYards,
  shortFor,
  slugify,
  uniqueId,
  type ClubDef,
  type Player,
  type Shot,
  type State,
  type Venue,
} from "./model.ts";
import { axis, byVenue, clubSpread, forClub, spread, venueGap, type Metric, type Spread } from "./stats.ts";
import { load, merge, save } from "./store.ts";
import { buildExport, exportName, parseExport } from "./exportfile.ts";

let state: State = load(localStorage);
let metric: Metric = "carry";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const view = $("view");

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const player = (): Player => state.players.find((p) => p.id === state.current.playerId) ?? state.players[0]!;
const clubOf = (id?: string) => player().clubs.find((c) => c.id === id);

function commit(): void {
  save(localStorage, state);
  render();
}

/* ---------- toast ---------- */

let toastTimer = 0;
function toast(text: string, undo?: () => void): void {
  const el = $("toast");
  $("toast-text").textContent = text;
  const btn = $<HTMLButtonElement>("toast-undo");
  btn.hidden = !undo;
  btn.onclick = () => {
    undo?.();
    el.hidden = true;
  };
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (el.hidden = true), undo ? 6000 : 3000);
}

/* ---------- routing ---------- */

type Route = { name: "card" | "log" | "bag" | "data" } | { name: "club"; id: string };

function route(): Route {
  const [, a, b] = location.hash.split("/");
  if (a === "club" && b) return { name: "club", id: decodeURIComponent(b) };
  if (a === "log" || a === "bag" || a === "data") return { name: a };
  return { name: "card" };
}

/* ---------- shared bits ---------- */

const metricToggle = () => `
  <div class="seg seg-sm" role="group" aria-label="Distance">
    ${(["carry", "total"] as Metric[])
      .map((m) => `<button type="button" data-metric="${m}" aria-pressed="${metric === m}">${m === "carry" ? "Carry" : "Total"}</button>`)
      .join("")}
  </div>`;

const pct = (v: number, a: { min: number; max: number }) => ((v - a.min) / (a.max - a.min)) * 100;

function bar(s: Spread | undefined, a: { min: number; max: number }, kind: "tee" | "ground"): string {
  if (!s) return `<div class="bar bar-${kind} is-empty"></div>`;
  const l = pct(s.low, a);
  const w = Math.max(pct(s.high, a) - l, 0.8);
  return `<div class="bar bar-${kind}">
    <i class="bar-range" style="left:${l}%;width:${w}%"></i>
    ${s.shots.map((x) => `<i class="bar-shot" style="left:${pct(x[metric]!, a)}%"></i>`).join("")}
    <i class="bar-typ" style="left:${pct(s.typical, a)}%"></i>
  </div>`;
}

function count(s: Spread | undefined): string {
  const n = s?.n ?? 0;
  return n >= GOOD_SHOTS ? "" : `<span class="count">${n}/${GOOD_SHOTS}</span>`;
}

const yd = (s?: Spread) => (s ? `<b>${s.typical}</b>` : `<b class="none">&middot;</b>`);

/* ---------- card ---------- */

function renderCard(): string {
  const p = player();
  const rows = p.clubs.map((c) => ({ c, s: clubSpread(state.shots, p.id, c.id, metric) }));
  const a = axis(rows.flatMap((r) => [r.s.tee, r.s.ground]));
  const ticks: number[] = [];
  for (let v = a.min; v <= a.max; v += a.step) ticks.push(v);
  const any = rows.some((r) => r.s.tee || r.s.ground);
  const grid = `background-size:${(a.step / (a.max - a.min)) * 100}% 100%`;

  return `
  <section class="card-view">
    <div class="view-head">
      <h1>${esc(p.name)}'s card</h1>
      ${metricToggle()}
    </div>
    <p class="legend"><span class="key key-tee"></span>Tee <span class="key key-ground"></span>No tee <span class="legend-note">Typical of your last ${GOOD_SHOTS} good shots, bar from low to high</span></p>
    ${
      any
        ? ""
        : `<div class="empty"><p>No good shots yet. Log ${GOOD_SHOTS} for a club and its row fills in. The bars share one scale, so the gaps between clubs show up as you go.</p><a class="btn btn-primary" href="#/log">Log a shot</a></div>`
    }
    <div class="axis" aria-hidden="true"><span></span><div class="axis-track">${ticks
      .map((t) => `<span style="left:${pct(t, a)}%">${t}</span>`)
      .join("")}</div><span></span></div>
    <ol class="rows">
      ${rows
        .map(
          ({ c, s }) => `
        <li><a class="row" href="#/club/${encodeURIComponent(c.id)}" aria-label="${esc(c.label)}: tee ${s.tee?.typical ?? "none"}, no tee ${s.ground?.typical ?? "none"} yards">
          <span class="row-club"><b>${esc(c.short)}</b><small>${esc(c.label)}</small></span>
          <span class="row-bars" style="${grid}">${bar(s.tee, a, "tee")}${bar(s.ground, a, "ground")}</span>
          <span class="row-yd"><span class="yd-tee">${yd(s.tee)}${count(s.tee)}</span><span class="yd-ground">${yd(s.ground)}${count(s.ground)}</span></span>
        </a></li>`,
        )
        .join("")}
    </ol>
  </section>`;
}

/* ---------- log ---------- */

function windowSlots(shots: Shot[], clubId: string, tee: boolean): string {
  const mine = forClub(shots, player().id, clubId).filter((s) => s.tee === tee);
  const s = spread(mine, metric);
  const slots = Array.from({ length: GOOD_SHOTS }, (_, i) => s?.shots[i]);
  return `
    <div class="slots-head${tee ? "" : " is-ground"}"><span>Last ${GOOD_SHOTS} good, ${tee ? "tee" : "no tee"}</span><span>${s ? `typical <b>${s.typical}</b>` : ""}</span></div>
    <ol class="slots">${slots
      .map((x) => (x ? `<li class="is-on" title="${VENUE_LABEL[x.venue]}"><b>${x[metric]}</b><small>${VENUE_LABEL[x.venue]}</small></li>` : `<li><b>&middot;</b><small>open</small></li>`))
      .join("")}</ol>`;
}

function renderLog(): string {
  const p = player();
  const cur = state.current;
  if (!clubOf(cur.clubId)) cur.clubId = p.clubs[0]?.id;
  const today = new Date().toISOString().slice(0, 10);
  const recent = state.shots
    .filter((s) => s.playerId === p.id && s.at.slice(0, 10) === today)
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .slice(0, 12);

  return `
  <section class="log-view">
    <div class="view-head"><h1>Log a shot</h1>${metricToggle()}</div>
    <form id="log-form" class="log" autocomplete="off" novalidate>
      <fieldset>
        <legend>Where</legend>
        <div class="seg seg-venue" role="group">
          ${VENUES.map(
            (v) => `<button type="button" data-venue="${v}" aria-pressed="${cur.venue === v}"><span>${VENUE_LABEL[v]}</span><small>${VENUE_HINT[v]}</small></button>`,
          ).join("")}
        </div>
      </fieldset>
      <fieldset>
        <legend>Club</legend>
        ${
          p.clubs.length
            ? `<div class="chips" role="group">${p.clubs
                .map((c) => `<button type="button" data-club="${esc(c.id)}" aria-pressed="${cur.clubId === c.id}" title="${esc(c.label)}">${esc(c.short)}</button>`)
                .join("")}</div>`
            : `<p class="hint">No clubs in ${esc(p.name)}'s bag. <a href="#/bag">Add some</a>.</p>`
        }
      </fieldset>
      <fieldset>
        <legend>Lie</legend>
        <div class="seg" role="group">
          <button type="button" data-tee="1" aria-pressed="${cur.tee}">Tee</button>
          <button type="button" data-tee="0" aria-pressed="${!cur.tee}">No tee</button>
        </div>
      </fieldset>
      <div class="yards">
        <label><span>Carry</span><input id="carry" inputmode="numeric" pattern="[0-9]*" placeholder="yd" aria-describedby="yards-err" /></label>
        <label><span>Total <small>optional</small></span><input id="total" inputmode="numeric" pattern="[0-9]*" placeholder="yd" /></label>
      </div>
      <p class="err" id="yards-err" role="alert" hidden></p>
      <div class="actions">
        <button type="submit" class="btn btn-primary btn-good" ${cur.clubId ? "" : "disabled"}>Good shot</button>
        <button type="button" class="btn btn-ghost btn-miss" id="mishit" ${cur.clubId ? "" : "disabled"}>Mishit</button>
      </div>
      <p class="hint">Mishits are kept in the club's history but never count toward the card.</p>
    </form>
    ${cur.clubId ? `<div class="window">${windowSlots(state.shots, cur.clubId, cur.tee)}</div>` : ""}
    ${
      recent.length
        ? `<div class="recent"><h2>Today</h2><ol class="shots">${recent.map(shotRow).join("")}</ol></div>`
        : ""
    }
  </section>`;
}

function shotRow(s: Shot): string {
  const c = clubOf(s.clubId);
  const time = new Date(s.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const date = new Date(s.at).toLocaleDateString([], { month: "short", day: "numeric" });
  return `<li class="shot ${s.good ? "" : "is-miss"}">
    <span class="shot-club">${esc(c?.short ?? "?")}</span>
    <span class="shot-yd">${s.carry ?? "&middot;"}<small>${s.total ? ` / ${s.total}` : ""}</small></span>
    <span class="shot-meta">${s.tee ? "Tee" : "No tee"} · ${VENUE_LABEL[s.venue]} · ${s.at.slice(0, 10) === new Date().toISOString().slice(0, 10) ? time : date}</span>
    <span class="shot-tag">${s.good ? "good" : "mishit"}</span>
    <span class="shot-act">
      <button type="button" class="link" data-toggle-good="${s.id}">${s.good ? "Mark mishit" : "Mark good"}</button>
      <button type="button" class="link link-del" data-delete="${s.id}" aria-label="Delete shot">Delete</button>
    </span>
  </li>`;
}

function logShot(good: boolean): void {
  const carryEl = $<HTMLInputElement>("carry");
  const totalEl = $<HTMLInputElement>("total");
  const err = $("yards-err");
  const carry = parseYards(carryEl.value);
  const total = parseYards(totalEl.value);
  const bad = (el: HTMLInputElement, v?: number) => el.value.trim() !== "" && v === undefined;
  if (bad(carryEl, carry) || bad(totalEl, total)) {
    err.textContent = "Yards are whole numbers from 1 to 450.";
    err.hidden = false;
    return;
  }
  if (carry === undefined && total === undefined) {
    err.textContent = "Enter a carry or a total. On the course, total from GPS or a laser is fine.";
    err.hidden = false;
    carryEl.focus();
    return;
  }
  const cur = state.current;
  if (!cur.clubId) return;
  const shot: Shot = {
    id: newId(),
    playerId: player().id,
    clubId: cur.clubId,
    tee: cur.tee,
    venue: cur.venue,
    ...(carry !== undefined ? { carry } : {}),
    ...(total !== undefined ? { total } : {}),
    good,
    at: new Date().toISOString(),
  };
  state.shots.push(shot);
  commit();
  const c = clubOf(shot.clubId);
  toast(`${good ? "Good" : "Mishit"} · ${c?.short ?? ""} ${shot.carry ?? shot.total} yd`, () => {
    state.shots = state.shots.filter((s) => s.id !== shot.id);
    commit();
  });
  $<HTMLInputElement>("carry")?.focus();
}

/* ---------- club detail ---------- */

function spreadBlock(title: string, s: Spread | undefined): string {
  if (!s) return `<div class="spread"><h2>${title}</h2><p class="hint">No good shots yet.</p></div>`;
  return `<div class="spread">
    <h2>${title}</h2>
    <div class="readout"><span><small>Low</small><b>${s.low}</b></span><span class="typ"><small>Typical</small><b>${s.typical}</b></span><span><small>High</small><b>${s.high}</b></span></div>
    <p class="hint">${s.n} of ${GOOD_SHOTS} good shots: ${s.shots.map((x) => `${x[metric]} <small>${VENUE_LABEL[x.venue]}</small>`).join(", ")}</p>
  </div>`;
}

function venueTable(shots: Shot[], label: string): string {
  const per = byVenue(shots, metric);
  const used = VENUES.filter((v) => per[v]);
  if (!used.length) return "";
  return `<div class="venues"><h3>${label}</h3><table>
    <thead><tr><th>Venue</th><th>Typical</th><th>Range</th><th>vs course</th></tr></thead>
    <tbody>${used
      .map((v) => {
        const s = per[v]!;
        const gap = venueGap(per, v);
        const gapCell = gap === undefined ? "&middot;" : gap === 0 ? "even" : `<span class="${gap > 0 ? "long" : "short"}">${gap > 0 ? "+" : "&minus;"}${Math.abs(gap)}</span>`;
        return `<tr><th scope="row">${VENUE_LABEL[v]}</th><td><b>${s.typical}</b></td><td>${s.low}&ndash;${s.high} <small>(${s.n})</small></td><td>${gapCell}</td></tr>`;
      })
      .join("")}</tbody></table></div>`;
}

function renderClub(id: string): string {
  const p = player();
  const c = clubOf(id);
  if (!c) return `<section><p class="hint">That club isn't in ${esc(p.name)}'s bag. <a href="#/card">Back to the card</a></p></section>`;
  const mine = forClub(state.shots, p.id, c.id);
  const s = clubSpread(state.shots, p.id, c.id, metric);
  const history = [...mine].sort((a, b) => (a.at < b.at ? 1 : -1));
  const tees = mine.filter((x) => x.tee);
  const grounds = mine.filter((x) => !x.tee);
  return `
  <section class="club-view">
    <a class="back" href="#/card">&larr; Card</a>
    <div class="view-head"><h1>${esc(c.label)}</h1>${metricToggle()}</div>
    <div class="spreads">${spreadBlock("Tee", s.tee)}${spreadBlock("No tee", s.ground)}</div>
    ${
      tees.length || grounds.length
        ? `<div class="venue-wrap"><h2>By venue</h2><p class="hint">Last ${GOOD_SHOTS} good shots at each. Positive means that venue reads longer than the course.</p>${venueTable(tees, "Tee")}${venueTable(grounds, "No tee")}</div>`
        : ""
    }
    <div class="actions"><a class="btn btn-primary" href="#/log" data-pick-club="${esc(c.id)}">Log ${esc(c.short)}</a></div>
    ${history.length ? `<div class="recent"><h2>Every shot <small>${history.length}</small></h2><ol class="shots">${history.map(shotRow).join("")}</ol></div>` : ""}
  </section>`;
}

/* ---------- bag ---------- */

function renderBag(): string {
  const p = player();
  const available = PRESETS.filter((x) => !p.clubs.some((c) => c.id === x.id));
  return `
  <section class="bag-view">
    <div class="view-head"><h1>${esc(p.name)}'s bag</h1></div>
    <p class="hint">Longest club first. That's the order of the card and the club picker. The short code is what the card shows.</p>
    <ol class="bag">
      ${p.clubs
        .map(
          (c, i) => `<li class="bag-row" data-row="${esc(c.id)}">
          <input class="bag-short" value="${esc(c.short)}" maxlength="3" aria-label="Short code for ${esc(c.label)}" data-edit="short" />
          <input class="bag-label" value="${esc(c.label)}" maxlength="24" aria-label="Name" data-edit="label" />
          <select class="bag-site" data-edit="site" aria-label="Matches on dandenney.com">
            <option value="">no match</option>
            ${SITE_CLUBS.filter((k) => k !== "putter")
              .map((k) => `<option value="${k}" ${c.site === k ? "selected" : ""}>${k}</option>`)
              .join("")}
          </select>
          <span class="bag-move">
            <button type="button" class="icon" data-move="-1" ${i === 0 ? "disabled" : ""} aria-label="Move ${esc(c.label)} up"><svg viewBox="0 0 16 16"><path d="M4 10l4-4 4 4"/></svg></button>
            <button type="button" class="icon" data-move="1" ${i === p.clubs.length - 1 ? "disabled" : ""} aria-label="Move ${esc(c.label)} down"><svg viewBox="0 0 16 16"><path d="M4 6l4 4 4-4"/></svg></button>
            <button type="button" class="icon icon-del" data-remove aria-label="Remove ${esc(c.label)}"><svg viewBox="0 0 16 16"><path d="M4 4l8 8M12 4l-8 8"/></svg></button>
          </span>
        </li>`,
        )
        .join("")}
    </ol>
    <form class="add" id="add-club">
      <h2>Add a club</h2>
      <div class="add-row">
        <select id="add-preset" aria-label="Common clubs">
          <option value="">Pick a common club…</option>
          ${available.map((x) => `<option value="${x.id}">${x.label}</option>`).join("")}
        </select>
        <span class="or">or</span>
        <input id="add-custom" placeholder="Name it: 52° Wedge, 4 Hybrid, Chipper" maxlength="24" aria-label="Custom club name" />
        <button type="submit" class="btn btn-primary">Add</button>
      </div>
      <p class="hint">New clubs go where their name says (a 7 Wood lands after the 5 Wood). Move them if not. Removing a club keeps its shots, so adding it back restores them.</p>
    </form>
  </section>`;
}

function insertIndex(clubs: ClubDef[], c: ClubDef): number {
  const r = loftOf(c.label);
  if (r === undefined) return clubs.length;
  const at = clubs.findIndex((x) => (loftOf(x.label) ?? -1) > r);
  return at < 0 ? clubs.length : at;
}

/* ---------- data ---------- */

function renderData(): string {
  const n = state.shots.length;
  const good = state.shots.filter((s) => s.good).length;
  const canShare = typeof navigator.canShare === "function";
  return `
  <section class="data-view">
    <div class="view-head"><h1>Export</h1></div>
    <p class="lede">Everything lives on this device: ${n} shot${n === 1 ? "" : "s"}, ${good} good, across ${state.players.length} players. Export a file to move it to another phone or to update the yardage card on dandenney.com/golf.</p>
    <div class="actions">
      ${canShare ? `<button type="button" class="btn btn-primary" id="share">Share file</button>` : ""}
      <button type="button" class="btn ${canShare ? "btn-ghost" : "btn-primary"}" id="download">Download file</button>
      <button type="button" class="btn btn-ghost" id="copy">Copy JSON</button>
    </div>
    <h2>Import</h2>
    <p class="hint">Merge a file from another phone. Shots already here are skipped, so importing twice is safe.</p>
    <label class="btn btn-ghost file"><input type="file" id="import" accept="application/json,.json" />Choose a file</label>
    <h2>On dandenney.com</h2>
    <p class="hint">Drop the file in the site repo and run <code>yarn golf:yardages stock-yardage-*.json</code>. It writes <code>src/data/golf/yardages.json</code>, and /golf and /golf/bag show the card. Clubs with a dandenney.com match line up with the bag. The rest still show by name.</p>
    <details class="danger"><summary>Erase this device</summary>
      <p class="hint">Deletes every shot and resets both bags. Export first.</p>
      <button type="button" class="btn btn-danger" id="erase">Erase everything</button>
    </details>
  </section>`;
}

function exportBlob(): { blob: Blob; name: string; text: string } {
  const text = JSON.stringify(buildExport(state), null, 2);
  return { blob: new Blob([text], { type: "application/json" }), name: exportName(), text };
}

/* ---------- render + events ---------- */

function render(): void {
  const r = route();
  $("players").innerHTML = state.players
    .map((p) => `<button type="button" data-player="${esc(p.id)}" aria-pressed="${p.id === player().id}">${esc(p.name)}</button>`)
    .join("");
  document.querySelectorAll<HTMLAnchorElement>("[data-tab]").forEach((a) => {
    const on = a.dataset.tab === r.name || (r.name === "club" && a.dataset.tab === "card");
    if (on) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  view.innerHTML =
    r.name === "log" ? renderLog() : r.name === "bag" ? renderBag() : r.name === "data" ? renderData() : r.name === "club" ? renderClub(r.id) : renderCard();
}

function editBag(fn: (clubs: ClubDef[]) => void): void {
  fn(player().clubs);
  commit();
}

view.addEventListener("click", async (e) => {
  const t = e.target as HTMLElement;
  const btn = t.closest<HTMLElement>("button, a");
  if (!btn) return;
  const d = btn.dataset;
  if (d.metric) {
    metric = d.metric as Metric;
    render();
  } else if (d.venue) {
    state.current.venue = d.venue as Venue;
    commit();
  } else if (d.club) {
    state.current.clubId = d.club;
    commit();
    $<HTMLInputElement>("carry")?.focus();
  } else if (d.tee) {
    state.current.tee = d.tee === "1";
    commit();
  } else if (d.pickClub) {
    state.current.clubId = d.pickClub;
    save(localStorage, state);
  } else if (btn.id === "mishit") {
    logShot(false);
  } else if (d.toggleGood) {
    const s = state.shots.find((x) => x.id === d.toggleGood);
    if (s) s.good = !s.good;
    commit();
  } else if (d.delete) {
    const s = state.shots.find((x) => x.id === d.delete);
    if (!s) return;
    state.shots = state.shots.filter((x) => x !== s);
    commit();
    toast("Shot deleted", () => {
      state.shots.push(s);
      commit();
    });
  } else if (d.move || "remove" in d) {
    const id = btn.closest<HTMLElement>("[data-row]")?.dataset.row;
    editBag((clubs) => {
      const i = clubs.findIndex((c) => c.id === id);
      if (i < 0) return;
      if (d.move) {
        const j = i + Number(d.move);
        if (j < 0 || j >= clubs.length) return;
        [clubs[i], clubs[j]] = [clubs[j]!, clubs[i]!];
      } else {
        const [gone] = clubs.splice(i, 1);
        toast(`Removed ${gone!.label}`, () => editBag((cs) => cs.splice(i, 0, gone!)));
      }
    });
  } else if (btn.id === "download") {
    const { blob, name } = exportBlob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  } else if (btn.id === "share") {
    const { blob, name } = exportBlob();
    const file = new File([blob], name, { type: "application/json" });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "Stock Yardage export" });
      } catch {
        /* dismissed */
      }
    } else toast("This browser can't share files. Use Download.");
  } else if (btn.id === "copy") {
    try {
      await navigator.clipboard.writeText(exportBlob().text);
      toast("Copied the export JSON");
    } catch {
      toast("Couldn't reach the clipboard. Use Download.");
    }
  } else if (btn.id === "erase") {
    const before = state;
    state = { ...load({ getItem: () => null }) };
    commit();
    toast("Erased", () => {
      state = before;
      commit();
    });
  }
});

view.addEventListener("submit", (e) => {
  e.preventDefault();
  const f = e.target as HTMLFormElement;
  if (f.id === "log-form") logShot(true);
  if (f.id === "add-club") {
    const preset = PRESETS.find((x) => x.id === $<HTMLSelectElement>("add-preset").value);
    const custom = $<HTMLInputElement>("add-custom").value.trim();
    if (!preset && !custom) {
      toast("Pick a club or type a name");
      return;
    }
    const clubs = player().clubs;
    const c: ClubDef = preset
      ? { ...preset }
      : { id: uniqueId(slugify(custom), clubs.map((x) => x.id)), label: custom, short: shortFor(custom) };
    if (clubs.some((x) => x.id === c.id)) {
      toast(`${c.label} is already in the bag`);
      return;
    }
    editBag((cs) => cs.splice(insertIndex(cs, c), 0, c));
    toast(`Added ${c.label}`);
  }
});

view.addEventListener("change", async (e) => {
  const t = e.target as HTMLInputElement | HTMLSelectElement;
  const field = t.dataset.edit;
  const id = t.closest<HTMLElement>("[data-row]")?.dataset.row;
  if (field && id) {
    const c = clubOf(id);
    if (!c) return;
    const v = t.value.trim();
    if (field === "label" && v) c.label = v;
    if (field === "short" && v) c.short = v.toUpperCase();
    if (field === "site") {
      if (v) c.site = v as ClubDef["site"];
      else delete c.site;
    }
    save(localStorage, state);
    return;
  }
  if (t.id === "import" && t instanceof HTMLInputElement && t.files?.[0]) {
    try {
      const incoming = parseExport(await t.files[0].text());
      const before = state;
      const { state: next, added } = merge(state, incoming);
      state = next;
      commit();
      toast(`Imported ${added} new shot${added === 1 ? "" : "s"}`, () => {
        state = before;
        commit();
      });
    } catch (err) {
      toast((err as Error).message);
    }
  }
});

view.addEventListener("input", (e) => {
  const t = e.target as HTMLElement;
  if (t.id === "carry" || t.id === "total") $("yards-err").hidden = true;
});

$("players").addEventListener("click", (e) => {
  const id = (e.target as HTMLElement).closest<HTMLElement>("[data-player]")?.dataset.player;
  if (!id) return;
  state.current.playerId = id;
  state.current.clubId = player().clubs[0]?.id;
  commit();
});

window.addEventListener("hashchange", () => {
  render();
  window.scrollTo(0, 0);
});
window.addEventListener("storage", (e) => {
  if (e.key === null || e.key.startsWith("stock-yardage")) {
    state = load(localStorage);
    render();
  }
});

render();

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}
