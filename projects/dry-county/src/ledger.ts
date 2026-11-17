// The still house as a ledger plate: a side-on cutaway in ink on paper with one copper accent.
// Same stations and contract as scene.ts, so main.ts can swap between the two looks.
import { RULES, hourOfDay, progress, type State } from "./sim.ts";
import { darkness } from "./scene.ts";

const INK = "#2b2520";
const PAPER = "#f3ecdb";
const PAPER2 = "#e9dfc6";
const COPPER = "#b8582a";
const W = 960;
const H = 540;
const FLOOR = 460;

const line = (x1: number, y1: number, x2: number, y2: number, w = 1.4, extra = "") =>
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${INK}" stroke-width="${w}" stroke-linecap="round" ${extra}/>`;
const pipe = (d: string, w = 6) =>
  `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${w + 3}" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${COPPER}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const hit = (station: string, label: string, body: string, extra = "") =>
  `<g class="hit" data-station="${station}" tabindex="0" role="button" aria-label="${label}" ${extra}><g class="lift">${body}</g></g>`;

const POS = {
  water: { x: 262, w: 80, h: 104 },
  barrels: [
    { x: 370, w: 110, h: 140 },
    { x: 500, w: 110, h: 140 },
  ],
  thumper: { x: 772, w: 48, h: 120 },
  worm: { x: 852, w: 88, h: 150 },
};
const CORN: [number, number][] = [[24, FLOOR], [70, FLOOR], [34, FLOOR - 44], [62, FLOOR - 44]];
const SUGAR: [number, number][] = [[124, FLOOR], [170, FLOOR], [134, FLOOR - 44], [162, FLOOR - 44]];
const SHELVES = [250, 200, 150];
const WATER_CUT = { x: POS.water.x + 14, y: FLOOR - POS.water.h + 16, w: POS.water.w - 28, h: POS.water.h - 28 };
const MASH = ["", "url(#l-stip-1)", "url(#l-stip-2)", "url(#l-stip-3)"];

function cask(x: number, w: number, h: number, inner = "", id = ""): string {
  const top = FLOOR - h;
  const mid = top + h / 2;
  const bulge = w * 0.06;
  const outline = `M${x + bulge},${top} Q${x - bulge},${mid} ${x + bulge},${FLOOR} L${x + w - bulge},${FLOOR} Q${x + w + bulge},${mid} ${x + w - bulge},${top} Z`;
  let staves = "";
  for (let i = 1; i < 5; i++) {
    const sx = x + (w * i) / 5;
    staves += `<path d="M${sx},${top} Q${sx + (sx - (x + w / 2)) * 0.12},${mid} ${sx},${FLOOR}" fill="none" stroke="${INK}" stroke-width=".8" opacity=".45"/>`;
  }
  const hoop = (f: number) => {
    const y = top + h * f;
    const dx = 0.46 * bulge;
    return `<path d="M${x + dx},${y} Q${x + w / 2},${y + 6} ${x + w - dx},${y}" fill="none" stroke="${INK}" stroke-width="3"/>`;
  };
  return `<g ${id ? `id="${id}"` : ""}>
    <ellipse cx="${x + w / 2}" cy="${FLOOR + 2}" rx="${w * 0.62}" ry="5" fill="${INK}" opacity=".18"/>
    <path d="${outline}" fill="${PAPER}" stroke="${INK}" stroke-width="1.8"/>
    ${staves}${hoop(0.16)}${hoop(0.84)}
    <ellipse cx="${x + w / 2}" cy="${top}" rx="${w / 2 - bulge}" ry="5" fill="${PAPER2}" stroke="${INK}" stroke-width="1.5"/>
    ${inner}
  </g>`;
}

/** A cut in the barrel's front showing what's inside. */
function cut(x: number, y: number, w: number, h: number, body: string): string {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${PAPER}" stroke="${INK}" stroke-width="1.2"/>
    ${body}
    <rect x="${x}" y="${y}" width="6" height="${h}" fill="url(#l-hatch-fine)"/>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="${INK}" stroke-width="1.2"/>`;
}

function sack(kind: "corn" | "sugar", x: number, bottom: number, id: string): string {
  const h = 56;
  const t = bottom - h;
  const d = `M${x + 6},${bottom} Q${x - 3},${bottom - h * 0.5} ${x + 10},${t + 10} L${x + 17},${t + 5} Q${x + 24},${t - 3} ${x + 31},${t + 5} L${x + 38},${t + 10} Q${x + 51},${bottom - h * 0.5} ${x + 42},${bottom} Z`;
  const mark =
    kind === "sugar"
      ? `${line(x + 4, bottom - 31, x + 44, bottom - 31, 1)}${line(x + 4, bottom - 27, x + 44, bottom - 27, 1)}`
      : `<path d="M${x + 20},${bottom - 34} q4,-6 8,0 q-4,6 -8,0 Z" fill="none" stroke="${INK}" stroke-width="1"/>`;
  return `<g id="${id}">
    <path d="${d}" fill="${PAPER}" stroke="${INK}" stroke-width="1.5"/>
    <path d="M${x + 12},${bottom - 6} Q${x + 24},${bottom - 2} ${x + 36},${bottom - 6}" fill="none" stroke="${INK}" stroke-width=".8" opacity=".5"/>
    ${line(x + 15, t + 11, x + 33, t + 11, 2.2)}
    ${mark}
    <text x="${x + 24}" y="${bottom - 13}" text-anchor="middle" class="l-stencil">${kind.toUpperCase()}</text>
  </g>`;
}

function jar(x: number, bottom: number, id: string, cls = "jar"): string {
  return `<g id="${id}" class="${cls}">
    <rect x="${x}" y="${bottom - 21}" width="16" height="20" rx="4" fill="${PAPER}" stroke="${INK}" stroke-width="1.3"/>
    <rect x="${x + 2}" y="${bottom - 25}" width="12" height="5" rx="1" fill="url(#l-hatch-fine)" stroke="${INK}" stroke-width="1.1"/>
    ${line(x + 4.5, bottom - 16, x + 4.5, bottom - 7, 0.9, 'opacity=".5"')}
  </g>`;
}

function tag(id: string, cx: number, y: number, title: string): string {
  return `<g id="${id}" class="sign tag" transform="translate(${cx},${y})">
    <rect x="-60" y="-16" width="120" height="48" fill="${PAPER}" stroke="${INK}" stroke-width=".9"/>
    <text class="l-tag-title" text-anchor="middle" y="1">${title}</text>
    <text class="l-tag-status" data-role="status" text-anchor="middle" y="16"></text>
    <line data-role="track" x1="-48" x2="48" y1="24" y2="24" stroke="${INK}" stroke-width="1" opacity=".3"/>
    <line data-role="bar" x1="-48" x2="-48" y1="24" y2="24" stroke="${COPPER}" stroke-width="3"/>
  </g>`;
}

function room(): string {
  let planks = "";
  for (let x = 58; x < W - 14; x += 44) planks += line(x, 44, x, FLOOR, 0.8, 'opacity=".2"');
  const knots = [[140, 96], [322, 182], [668, 140], [884, 220], [756, 92]]
    .map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="5" ry="2.4" fill="none" stroke="${INK}" stroke-width=".7" opacity=".35"/>`)
    .join("");
  const door = `<g>
    <rect x="236" y="246" width="86" height="${FLOOR - 246}" fill="${PAPER2}" stroke="${INK}" stroke-width="2"/>
    ${[257, 279, 301].map((x) => line(x, 248, x, FLOOR, 0.8, 'opacity=".5"')).join("")}
    ${line(240, 300, 318, 300, 2)}${line(240, 410, 318, 410, 2)}${line(242, 404, 316, 306, 2)}
    <circle cx="310" cy="356" r="3" fill="${PAPER}" stroke="${INK}" stroke-width="1.3"/>
  </g>`;
  const win = `<g>
    <rect x="420" y="90" width="120" height="110" fill="${PAPER}" stroke="${INK}" stroke-width="2"/>
    <g clip-path="url(#l-window)">
      <rect id="l-sky" x="424" y="94" width="112" height="102" fill="#27304d" opacity="0"/>
      <circle id="l-moon" cx="470" cy="130" r="10" fill="${PAPER}" stroke="${INK}" stroke-width="1.4"/>
      <path d="M424,176 q26,-24 54,-8 t58,-10 V196 H424 Z" fill="${PAPER}" stroke="${INK}" stroke-width="1.2"/>
      <path d="M424,176 q26,-24 54,-8 t58,-10 V196 H424 Z" fill="url(#l-hatch-fine)"/>
    </g>
    ${line(480, 92, 480, 198, 2.2)}${line(422, 145, 538, 145, 2.2)}
    <rect x="412" y="200" width="136" height="8" fill="${PAPER}" stroke="${INK}" stroke-width="1.6"/>
  </g>`;
  const shelf = SHELVES.map(
    (y) => `<rect x="26" y="${y}" width="214" height="7" fill="${PAPER}" stroke="${INK}" stroke-width="1.4"/>
      <path d="M40,${y + 7} V${y + 20} L54,${y + 7} Z M226,${y + 7} V${y + 20} L212,${y + 7} Z" fill="${PAPER2}" stroke="${INK}" stroke-width="1.1"/>`,
  ).join("");
  const jars = Array.from({ length: 24 }, (_, k) => jar(40 + (k % 8) * 24, SHELVES[Math.floor(k / 8)]!, `jar-${k}`)).join("");
  return `<rect x="0" y="0" width="${W}" height="${H}" fill="${PAPER}"/>
    <rect x="14" y="40" width="${W - 28}" height="${FLOOR - 40}" fill="${PAPER2}"/>
    ${planks}${knots}
    <rect x="0" y="26" width="${W}" height="18" fill="${PAPER}" stroke="${INK}" stroke-width="1.6"/>
    <rect x="0" y="26" width="${W}" height="18" fill="url(#l-hatch)"/>
    ${door}${win}
    <rect x="0" y="${FLOOR}" width="${W}" height="${H - FLOOR}" fill="url(#l-hatch)"/>
    ${line(0, FLOOR, W, FLOOR, 2.2)}${line(0, FLOOR + 9, W, FLOOR + 9, 0.8, 'opacity=".5"')}
    ${hit("shelf", "Jar shelf", `<rect x="22" y="110" width="222" height="150" fill="transparent"/>${shelf}${jars}`)}`;
}

function lantern(): string {
  return `<g>${line(600, 44, 600, 96, 1.4)}
    <path d="M588,104 L612,104 L606,96 L594,96 Z" fill="url(#l-hatch-fine)" stroke="${INK}" stroke-width="1.3"/>
    <rect x="590" y="104" width="20" height="24" rx="3" fill="${PAPER}" stroke="${INK}" stroke-width="1.5"/>
    <path d="M600,124 C595,119 597,113 600,109 C603,113 605,119 600,124 Z" fill="${COPPER}"/>
    <rect x="586" y="127" width="28" height="5" rx="2" fill="${PAPER}" stroke="${INK}" stroke-width="1.3"/></g>`;
}

function waterBarrel(): string {
  const { x, w, h } = POS.water;
  const c = WATER_CUT;
  const inner = cut(c.x, c.y, c.w, c.h, `<rect id="l-water" x="${c.x}" y="${c.y}" width="${c.w}" height="0" fill="url(#l-water-p)"/>${line(c.x, c.y, c.x + c.w, c.y, 1.3, 'id="l-water-line"')}`);
  const bucket = `<path d="M346,${FLOOR} L342,${FLOOR - 24} L366,${FLOOR - 24} L362,${FLOOR} Z" fill="${PAPER}" stroke="${INK}" stroke-width="1.3"/><path d="M342,${FLOOR - 24} Q354,${FLOOR - 40} 366,${FLOOR - 24}" fill="none" stroke="${INK}" stroke-width="1"/>`;
  return hit("water", "Water barrel and the creek", cask(x, w, h, inner) + bucket);
}

function mashBarrel(i: number): string {
  const { x, w, h } = POS.barrels[i]!;
  const top = FLOOR - h;
  const cx = x + 16;
  const cy = top + 18;
  const cw = w - 32;
  const ch = h - 34;
  const level = cy + 26;
  const bubbles = [0.2, 0.45, 0.7, 0.85]
    .map((f, k) => `<circle class="bubble" style="--d:${(k * 0.37).toFixed(2)}s" cx="${cx + cw * f}" cy="${level + 4 + (k % 2) * 6}" r="${2.4 + (k % 3)}" fill="${PAPER}" stroke="${INK}" stroke-width="1"/>`)
    .join("");
  const steam = [-18, 0, 18]
    .map((dx, k) => `<path class="steam" style="--d:${(k * 0.6).toFixed(1)}s" d="M${x + w / 2 + dx},${top - 6} c-6,-8 6,-14 0,-22 c-6,-8 6,-14 0,-22" fill="none" stroke="${INK}" stroke-width="1.4" stroke-linecap="round"/>`)
    .join("");
  const body = `<rect data-role="mash" x="${cx}" y="${level}" width="${cw}" height="${cy + ch - level}" fill="none"/>
    <line data-role="surface" x1="${cx}" x2="${cx + cw}" y1="${level}" y2="${level}" stroke="${INK}" stroke-width="1.3" opacity="0"/>
    <g data-role="bubbles">${bubbles}</g>`;
  const paddle = i === 0 ? `${line(x + w * 0.62, top + 30, x + w * 0.9, top - 58, 4)}<line x1="${x + w * 0.62}" y1="${top + 30}" x2="${x + w * 0.9}" y2="${top - 58}" stroke="${PAPER}" stroke-width="1.6" stroke-linecap="round"/>` : "";
  return hit(`barrel-${i}`, `Mash barrel ${i + 1}`, `<g id="barrel-${i}-in">${paddle}${cask(x, w, h, cut(cx, cy, cw, ch, body))}<g data-role="steam">${steam}</g></g>`);
}

function still(): string {
  const th = POS.thumper;
  const wm = POS.worm;
  const fire = `<path d="M676,${FLOOR} V436 Q700,414 724,436 V${FLOOR} Z" fill="${INK}" opacity=".88"/>
    <g id="fire" class="fire"><path d="M682,${FLOOR} C680,450 690,446 690,436 C696,442 698,446 699,450 C701,442 706,438 707,432 C713,440 718,450 716,${FLOOR} Z" fill="${COPPER}"/>
    <path d="M691,${FLOOR} C690,454 695,452 696,446 C699,450 701,452 702,455 C704,451 706,450 707,447 C709,452 709,456 708,${FLOOR} Z" fill="${PAPER}"/></g>`;
  const firebox = `<rect x="640" y="396" width="120" height="${FLOOR - 396}" fill="${PAPER}" stroke="${INK}" stroke-width="1.8"/>
    <rect x="640" y="396" width="120" height="${FLOOR - 396}" fill="url(#l-brick)"/>${fire}`;
  const pot = `<path d="M650,396 L650,340 Q650,300 700,296 Q750,300 750,340 L750,396 Z" fill="${COPPER}" stroke="${INK}" stroke-width="1.8"/>
    <path d="M730,302 Q750,316 750,340 L750,396 L736,396 L736,340 Q736,318 722,300 Z" fill="url(#l-hatch-fine)"/>
    ${Array.from({ length: 9 }, (_, k) => `<circle cx="${656 + k * 11}" cy="342" r="1.5" fill="${INK}"/>`).join("")}
    <path d="M684,298 Q670,278 690,262 Q700,254 710,262 Q730,278 716,298 Z" fill="${COPPER}" stroke="${INK}" stroke-width="1.6"/>
    <rect x="694" y="244" width="12" height="18" fill="${COPPER}" stroke="${INK}" stroke-width="1.4"/>`;
  const steam = [-14, 12]
    .map((dx, k) => `<path class="steam" style="--d:${(k * 0.8).toFixed(1)}s" d="M${700 + dx},250 c-5,-7 5,-12 0,-19 c-5,-7 5,-12 0,-19" fill="none" stroke="${INK}" stroke-width="1.3" stroke-linecap="round"/>`)
    .join("");
  const arm = pipe(`M700,248 Q756,214 796,262 L796,${FLOOR - th.h + 4}`);
  const arm2 = pipe(`M812,${FLOOR - th.h + 14} Q830,296 870,300 L870,${FLOOR - wm.h + 6}`, 5);
  const wc = { x: wm.x + 14, y: FLOOR - wm.h + 20, w: wm.w - 28, h: wm.h - 36 };
  const coil = Array.from({ length: 6 }, (_, k) => {
    const y = wc.y + 12 + k * 17;
    const d = `M${wc.x + 6},${y} Q${wc.x + wc.w / 2},${y + 9} ${wc.x + wc.w - 6},${y}`;
    return `<path d="${d}" fill="none" stroke="${INK}" stroke-width="5.5"/><path d="${d}" fill="none" stroke="${COPPER}" stroke-width="3"/>`;
  }).join("");
  const worm = cask(wm.x, wm.w, wm.h, cut(wc.x, wc.y, wc.w, wc.h, `<rect x="${wc.x}" y="${wc.y + 4}" width="${wc.w}" height="${wc.h - 4}" fill="url(#l-water-p)"/>${coil}`));
  const spout = pipe(`M${wm.x + 6},436 L846,440`, 4);
  const jarFill = `<rect id="l-spout-fill" x="827" y="${FLOOR - 1}" width="14" height="0" fill="url(#l-hatch-fine)"/>`;
  const sj = `<g id="spout-jar"><rect x="826" y="${FLOOR - 21}" width="16" height="20" rx="4" fill="${PAPER}" stroke="${INK}" stroke-width="1.3"/>${jarFill}<rect x="826" y="${FLOOR - 21}" width="16" height="20" rx="4" fill="none" stroke="${INK}" stroke-width="1.3"/></g>`;
  const drip = `<circle id="drip" cx="841" cy="443" r="2" fill="${PAPER}" stroke="${INK}" stroke-width="1"/>`;
  return hit(
    "still",
    "The still",
    `${firebox}${pot}<g id="pot-steam">${steam}</g>${cask(th.x, th.w, th.h)}${arm}${worm}${arm2}${spout}${sj}${drip}`,
  );
}

const DEFS = `<defs>
  <pattern id="l-hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="7" stroke="${INK}" stroke-width="1" opacity=".5"/></pattern>
  <pattern id="l-hatch-fine" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)"><line x1="0" y1="0" x2="0" y2="4" stroke="${INK}" stroke-width=".8" opacity=".55"/></pattern>
  <pattern id="l-stip-1" width="9" height="9" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r=".9" fill="${INK}"/><circle cx="6.5" cy="6" r=".8" fill="${INK}"/></pattern>
  <pattern id="l-stip-2" width="6" height="6" patternUnits="userSpaceOnUse"><circle cx="1.5" cy="1.5" r="1" fill="${INK}"/><circle cx="4.5" cy="4" r=".9" fill="${INK}"/></pattern>
  <pattern id="l-stip-3" width="5" height="5" patternUnits="userSpaceOnUse"><circle cx="1.2" cy="1.2" r="1.1" fill="${INK}"/><circle cx="3.7" cy="3.6" r="1" fill="${INK}"/><circle cx="3.8" cy="1" r=".6" fill="${INK}"/></pattern>
  <pattern id="l-water-p" width="16" height="7" patternUnits="userSpaceOnUse"><path d="M0,4 q4,-3 8,0 t8,0" fill="none" stroke="${INK}" stroke-width=".9" opacity=".55"/></pattern>
  <pattern id="l-brick" width="24" height="12" patternUnits="userSpaceOnUse"><path d="M0,0 H24 M0,6 H24 M6,0 V6 M18,6 V12" stroke="${INK}" stroke-width=".9" fill="none" opacity=".6"/></pattern>
  <radialGradient id="l-night-g" cx="600" cy="150" r="600" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#27304d" stop-opacity="0"/><stop offset=".3" stop-color="#27304d" stop-opacity=".1"/><stop offset="1" stop-color="#27304d" stop-opacity=".7"/></radialGradient>
  <clipPath id="l-window"><rect x="424" y="94" width="112" height="102"/></clipPath>
</defs>`;

export function ledgerSVG(): string {
  const corn = CORN.map(([x, b], k) => sack("corn", x, b, `corn-${k}`)).join("");
  const sugar = SUGAR.map(([x, b], k) => sack("sugar", x, b, `sugar-${k}`)).join("");
  return `<svg id="scene" class="ledger-scene" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
    ${DEFS}
    <g id="world">
      ${room()}
      ${lantern()}
      ${hit("pantry", "Corn and sugar", corn + sugar)}
      ${waterBarrel()}
      ${mashBarrel(0)}
      ${mashBarrel(1)}
      ${still()}
      <rect x="318" y="494" width="324" height="34" fill="${PAPER}" stroke="${INK}" stroke-width="1.2"/>
      <text x="480" y="517" text-anchor="middle" class="l-plate">Plate I. The Still House, Dry County</text>
    </g>
    <rect id="l-night" x="0" y="0" width="${W}" height="${H}" fill="url(#l-night-g)" opacity="0" pointer-events="none"/>
    <rect x="5" y="5" width="${W - 10}" height="${H - 10}" fill="none" stroke="${INK}" stroke-width="2.5" pointer-events="none"/>
    <rect x="11" y="11" width="${W - 22}" height="${H - 22}" fill="none" stroke="${INK}" stroke-width=".8" pointer-events="none"/>
    <g id="signs" pointer-events="none">
      ${tag("sign-water", 300, 296, "Water")}
      ${tag("sign-barrel-0", 425, 268, "Barrel No. 1")}
      ${tag("sign-barrel-1", 555, 268, "Barrel No. 2")}
      ${tag("sign-still", 700, 198, "The Still")}
    </g>
  </svg>`;
}

const $ = <E extends Element>(root: ParentNode, sel: string) => root.querySelector<E>(sel)!;

function setTag(root: ParentNode, id: string, status: string, p: number | null, alert = false): void {
  const g = $<SVGGElement>(root, `#${id}`);
  $(g, '[data-role="status"]').textContent = status;
  $(g, '[data-role="bar"]').setAttribute("x2", String(-48 + Math.round(96 * (p ?? 0))));
  $(g, '[data-role="bar"]').setAttribute("opacity", p === null ? "0" : "1");
  $(g, '[data-role="track"]').setAttribute("opacity", p === null ? "0" : ".3");
  g.classList.toggle("alert", alert);
}

export function updateLedger(root: ParentNode, s: State): void {
  const hours = hourOfDay(s.clock);
  const dark = darkness(hours);
  $(root, "#l-night").setAttribute("opacity", dark.toFixed(3));
  $(root, "#l-sky").setAttribute("opacity", (dark * 0.92).toFixed(3));
  const f = (((hours - 6) % 12) + 12) % 12 / 12;
  const moon = $(root, "#l-moon");
  moon.setAttribute("cx", (424 + 112 * f).toFixed(1));
  moon.setAttribute("cy", (178 - Math.sin(f * Math.PI) * 58).toFixed(1));
  moon.setAttribute("stroke-width", dark > 0.5 ? "0" : "1.4");

  CORN.forEach((_, k) => $(root, `#corn-${k}`).setAttribute("opacity", k < s.corn ? "1" : "0"));
  SUGAR.forEach((_, k) => $(root, `#sugar-${k}`).setAttribute("opacity", k < s.sugar ? "1" : "0"));
  for (let k = 0; k < 24; k++) $(root, `#jar-${k}`).setAttribute("opacity", k < s.jars ? "1" : "0");

  const fill = s.water / RULES.waterCap;
  const c = WATER_CUT;
  const wy = c.y + c.h * (1 - fill);
  const water = $(root, "#l-water");
  water.setAttribute("y", wy.toFixed(1));
  water.setAttribute("height", (c.h * fill).toFixed(1));
  const wl = $(root, "#l-water-line");
  wl.setAttribute("y1", wy.toFixed(1));
  wl.setAttribute("y2", wy.toFixed(1));
  wl.setAttribute("opacity", fill > 0 ? "1" : "0");
  setTag(root, "sign-water", s.haul ? "Hauling from creek" : `${s.water} of ${RULES.waterCap} gal`, s.haul ? progress(s.haul.from, s.haul.until, s.clock) : fill);

  s.barrels.forEach((bar, i) => {
    const g = $<SVGGElement>(root, `#barrel-${i}-in`);
    g.dataset.status = bar.status;
    const stage = { empty: 0, cooking: 1, working: 2, ready: 3 }[bar.status];
    $(g, '[data-role="mash"]').setAttribute("fill", MASH[stage] || "none");
    $(g, '[data-role="surface"]').setAttribute("opacity", stage ? "1" : "0");
    const [status, p] =
      bar.status === "empty"
        ? ["Empty", null]
        : bar.status === "cooking"
          ? ["Cooking the mash", progress(bar.from, bar.until, s.clock)]
          : bar.status === "working"
            ? ["Fermenting", progress(bar.from, bar.until, s.clock)]
            : ["Ready to run", 1];
    setTag(root, `sign-barrel-${i}`, status, p, bar.status === "ready");
  });

  const still = s.still;
  const g = $<SVGGElement>(root, '[data-station="still"]');
  g.dataset.status = still.status;
  const running = still.status === "running";
  const jf = running ? (progress(still.from, still.until, s.clock) * RULES.jarsPerRun) % 1 : 0;
  const sf = $(root, "#l-spout-fill");
  sf.setAttribute("y", (FLOOR - 2 - 17 * jf).toFixed(1));
  sf.setAttribute("height", (17 * jf).toFixed(1));
  setTag(
    root,
    "sign-still",
    still.status === "cold" ? "Cold and empty" : still.status === "loaded" ? "Full. Light the fire" : `Running, jar ${Math.min(still.jars + 1, RULES.jarsPerRun)} of ${RULES.jarsPerRun}`,
    running ? progress(still.from, still.until, s.clock) : null,
    still.status === "loaded",
  );
}
