// The still house, drawn as isometric SVG. Built once; update() moves the parts that change.
import { RULES, hourOfDay, progress, type State } from "./sim.ts";

const T = 48;
const COS = 0.866;
const ROOM = { w: 10, d: 8, h: 3.6 };

type P = [number, number];
const iso = (x: number, y: number, z = 0): P => [(x - y) * T * COS, (x + y) * T * 0.5 - z * T];
const pts = (...p: P[]) => p.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(" ");
const poly = (fill: string, p: P[], extra = "") => `<polygon points="${pts(...p)}" fill="${fill}" ${extra}/>`;
/** Screen radii of a floor circle of radius r tiles. */
const ell = (r: number) => ({ rx: r * T * COS * Math.SQRT2, ry: r * T * 0.5 * Math.SQRT2 });

function cylinder(x: number, y: number, z: number, r: number, h: number, side: string, stroke = "#2b1a10"): string {
  const { rx, ry } = ell(r);
  const [cx, top] = iso(x, y, z + h);
  const [, bot] = iso(x, y, z);
  return `<path d="M${cx - rx},${top} L${cx - rx},${bot} A${rx},${ry} 0 0 0 ${cx + rx},${bot} L${cx + rx},${top} Z" fill="${side}" stroke="${stroke}" stroke-width="1.5"/>`;
}

function ellipseAt(x: number, y: number, z: number, r: number, fill: string, extra = ""): string {
  const { rx, ry } = ell(r);
  const [cx, cy] = iso(x, y, z);
  return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" ${extra}/>`;
}

/** The front half of a ring around a cylinder, for barrel hoops. */
function hoop(x: number, y: number, z: number, r: number, color = "#3a3330", width = 3): string {
  const { rx, ry } = ell(r);
  const [cx, cy] = iso(x, y, z);
  return `<path d="M${cx - rx},${cy} A${rx},${ry} 0 0 0 ${cx + rx},${cy}" fill="none" stroke="${color}" stroke-width="${width}"/>`;
}

function box(x: number, y: number, z: number, w: number, d: number, h: number, top: string, left: string, right: string, extra = ""): string {
  const s = 'stroke="#2b1a10" stroke-width="1.2" stroke-linejoin="round"';
  return (
    poly(left, [iso(x, y + d, z), iso(x + w, y + d, z), iso(x + w, y + d, z + h), iso(x, y + d, z + h)], s + extra) +
    poly(right, [iso(x + w, y, z), iso(x + w, y + d, z), iso(x + w, y + d, z + h), iso(x + w, y, z + h)], s + extra) +
    poly(top, [iso(x, y, z + h), iso(x + w, y, z + h), iso(x + w, y + d, z + h), iso(x, y + d, z + h)], s + extra)
  );
}

function barrel(x: number, y: number, r: number, h: number, id: string, inner: string): string {
  return (
    `<ellipse cx="${iso(x, y)[0]}" cy="${iso(x, y)[1] + 4}" rx="${ell(r).rx + 6}" ry="${ell(r).ry + 4}" fill="#2b1a10" opacity=".28"/>` +
    cylinder(x, y, 0, r, h, "url(#wood)") +
    staves(x, y, r, h) +
    hoop(x, y, h * 0.18, r) +
    hoop(x, y, h * 0.8, r) +
    ellipseAt(x, y, h, r, "#7a4a26", 'stroke="#2b1a10" stroke-width="1.5"') +
    ellipseAt(x, y, h, r * 0.86, "#2e1b0f") +
    `<g id="${id}">${inner}</g>`
  );
}

function staves(x: number, y: number, r: number, h: number): string {
  const { rx } = ell(r);
  const [cx, top] = iso(x, y, h);
  const [, bot] = iso(x, y, 0);
  const { ry } = ell(r);
  let out = "";
  for (const f of [-0.62, -0.22, 0.22, 0.62]) {
    const sx = cx + rx * f;
    const dy = ry * Math.sqrt(1 - f * f);
    out += `<line x1="${sx}" y1="${top + dy}" x2="${sx}" y2="${bot + dy}" stroke="#4a2c16" stroke-width="1" opacity=".55"/>`;
  }
  return out;
}

function sack(kind: "corn" | "sugar", x: number, y: number, z: number, id: string): string {
  const [cx, cy] = iso(x, y, z);
  const fill = kind === "corn" ? "url(#burlap)" : "url(#sugarcloth)";
  const band =
    kind === "sugar"
      ? `<path d="M-22,-8 C-10,-4 10,-4 22,-8 L23,-1 C10,3 -10,3 -23,-1 Z" fill="#2f6aa8"/>`
      : `<circle cx="-4" cy="-33" r="2.4" fill="#f2c230"/><circle cx="2" cy="-35" r="2.4" fill="#e9b422"/><circle cx="6" cy="-32" r="2.2" fill="#f2c230"/>`;
  const label = kind === "corn" ? "CORN" : "SUGAR";
  const ink = kind === "corn" ? "#5c3b17" : "#2f6aa8";
  return `<g id="${id}" transform="translate(${cx.toFixed(1)},${(cy - 2).toFixed(1)})">
    <ellipse cx="0" cy="6" rx="26" ry="9" fill="#2b1a10" opacity=".3"/>
    <path d="M-23,4 C-27,-14 -15,-26 -6,-27 L6,-27 C15,-26 27,-14 23,4 C19,12 -19,12 -23,4 Z" fill="${fill}" stroke="#2b1a10" stroke-width="1.5"/>
    ${band}
    <path d="M-6,-26 L-4,-32 L4,-32 L6,-26 Z" fill="${fill}" stroke="#2b1a10" stroke-width="1.2"/>
    <rect x="-5.5" y="-30" width="11" height="3" rx="1" fill="#6b4a22"/>
    <text x="0" y="${kind === "sugar" ? -11 : -6}" text-anchor="middle" class="stencil" fill="${ink}">${label}</text>
  </g>`;
}

function jar(x: number, y: number, z: number, id: string, scale = 1): string {
  const [cx, cy] = iso(x, y, z);
  return `<g id="${id}" class="jar" transform="translate(${cx.toFixed(1)},${cy.toFixed(1)}) scale(${scale})">
    <rect x="-6" y="-18" width="12" height="18" rx="3" fill="#dceef0" fill-opacity=".55" stroke="#2b1a10" stroke-width="1.2"/>
    <rect class="shine" x="-5" y="-14" width="10" height="13.5" rx="2.5" fill="#f3ecc8"/>
    <rect x="-5" y="-21" width="10" height="4" rx="1" fill="#9a9a94" stroke="#2b1a10" stroke-width="1"/>
    <rect x="-3.5" y="-15" width="2" height="11" rx="1" fill="#fff" opacity=".7"/>
  </g>`;
}

function sign(id: string, x: number, y: number, z: number, title: string): string {
  const [cx, cy] = iso(x, y, z);
  return `<g id="${id}" class="sign" transform="translate(${cx.toFixed(1)},${cy.toFixed(1)})">
    <path d="M0,10 L-6,0 L6,0 Z" fill="#2a1a12" stroke="#d7a640" stroke-width="1.5"/>
    <rect x="-62" y="-40" width="124" height="42" rx="5" fill="#2a1a12" stroke="#d7a640" stroke-width="2"/>
    <text x="-53" y="-24" class="sign-title">${title}</text>
    <text x="-53" y="-10" class="sign-status" data-role="status"></text>
    <rect x="-53" y="-5" width="106" height="3.5" rx="1.75" fill="#5a4030" data-role="track"/>
    <rect x="-53" y="-5" width="0" height="3.5" rx="1.75" fill="#f0c24e" data-role="bar"/>
  </g>`;
}

const POS = {
  water: { x: 1.1, y: 6.6, r: 0.55, h: 1.05 },
  barrels: [
    { x: 3.0, y: 4.7, r: 0.8, h: 1.35 },
    { x: 5.5, y: 3.5, r: 0.8, h: 1.35 },
  ],
  pot: { x: 7.7, y: 1.6, r: 0.62, z: 0.72, h: 0.95 },
  thumper: { x: 8.95, y: 3.15, r: 0.4, h: 0.95 },
  worm: { x: 8.85, y: 5.0, r: 0.62, h: 1.25 },
  spoutJar: { x: 8.0, y: 6.05 },
};

const CORN: [number, number, number][] = [[0.95, 0.95, 0], [1.95, 0.9, 0], [0.9, 1.95, 0], [1.35, 1.35, 0.55]];
const SUGAR: [number, number, number][] = [[3.0, 0.9, 0], [3.95, 0.9, 0], [3.0, 1.85, 0], [3.45, 1.3, 0.55]];

function shelfJars(): string {
  let out = "";
  let n = 0;
  for (const z of [0.42, 1.12, 1.82]) {
    for (let k = 0; k < 8; k++) {
      out += jar(0.3, 5.25 + k * 0.3, z, `jar-${n++}`, 0.85);
    }
  }
  return out;
}

function shelf(): string {
  let out = "";
  out += box(0, 5.0, 0, 0.55, 0.12, 2.5, "#8a5a32", "#6b4223", "#7e5130");
  out += box(0, 7.55, 0, 0.55, 0.12, 2.5, "#8a5a32", "#6b4223", "#7e5130");
  for (const z of [0.32, 1.02, 1.72]) out += box(0, 5.0, z, 0.55, 2.67, 0.1, "#a8743f", "#7a4c28", "#8f5f34");
  return out + shelfJars();
}

function room(): string {
  const { w, d, h } = ROOM;
  let out = "";
  out += poly("url(#floor)", [iso(0, 0), iso(w, 0), iso(w, d), iso(0, d)], 'stroke="#2b1a10" stroke-width="2"');
  for (let y = 0.5; y < d; y += 0.5) out += `<line x1="${iso(0, y)[0]}" y1="${iso(0, y)[1]}" x2="${iso(w, y)[0]}" y2="${iso(w, y)[1]}" stroke="#5b3a20" stroke-width="1" opacity=".55"/>`;
  for (let i = 0; i < 18; i++) {
    const y = 0.5 * ((i * 7) % 16) + 0.25;
    const x = ((i * 3.7) % 9) + 0.2;
    out += `<line x1="${iso(x, y)[0]}" y1="${iso(x, y)[1]}" x2="${iso(x, y + 0.5)[0]}" y2="${iso(x, y + 0.5)[1]}" stroke="#5b3a20" stroke-width="1" opacity=".45"/>`;
  }
  // back-left wall (x = 0) and back-right wall (y = 0)
  out += poly("url(#wallL)", [iso(0, 0), iso(0, d), iso(0, d, h), iso(0, 0, h)], 'stroke="#2b1a10" stroke-width="2"');
  out += poly("url(#wallR)", [iso(0, 0), iso(w, 0), iso(w, 0, h), iso(0, 0, h)], 'stroke="#2b1a10" stroke-width="2"');
  for (let y = 0.55; y < d; y += 0.55) out += `<line x1="${iso(0, y)[0]}" y1="${iso(0, y)[1]}" x2="${iso(0, y, h)[0]}" y2="${iso(0, y, h)[1]}" stroke="#3d2614" stroke-width="1.2" opacity=".5"/>`;
  for (let x = 0.55; x < w; x += 0.55) out += `<line x1="${iso(x, 0)[0]}" y1="${iso(x, 0)[1]}" x2="${iso(x, 0, h)[0]}" y2="${iso(x, 0, h)[1]}" stroke="#3d2614" stroke-width="1.2" opacity=".5"/>`;
  // cutaway wall tops
  out += poly("#c7965e", [iso(0, 0, h), iso(w, 0, h), iso(w, -0.25, h), iso(-0.25, -0.25, h), iso(-0.25, d, h), iso(0, d, h)], 'stroke="#2b1a10" stroke-width="1.5"');
  // beam across for the lantern
  out += box(4.5, 0, h - 0.35, 0.22, d, 0.22, "#6e4426", "#4d2e18", "#5d3a1f");
  // window in the right wall
  const win = (a: number, b: number, z0: number, z1: number) => [iso(a, 0, z0), iso(b, 0, z0), iso(b, 0, z1), iso(a, 0, z1)] as P[];
  out += poly("#3a2414", win(4.9, 6.9, 1.4, 2.9));
  out += `<g id="window">${poly("url(#sky)", win(5.0, 6.8, 1.5, 2.8), 'id="sky-pane"')}<circle id="moon" r="7" fill="#f6efd4"/></g>`;
  out += `<polyline points="${pts(iso(5.9, 0, 1.5), iso(5.9, 0, 2.8))}" stroke="#3a2414" stroke-width="4"/>`;
  out += `<polyline points="${pts(iso(5.0, 0, 2.15), iso(6.8, 0, 2.15))}" stroke="#3a2414" stroke-width="4"/>`;
  // door in the left wall
  const door = (a: number, b: number, z: number) => [iso(0, a), iso(0, b), iso(0, b, z), iso(0, a, z)] as P[];
  out += poly("#3a2414", door(2.3, 3.9, 2.7));
  out += poly("#7b4f2c", door(2.4, 3.8, 2.6), 'stroke="#2b1a10" stroke-width="1.5"');
  for (const y of [2.75, 3.1, 3.45]) out += `<line x1="${iso(0, y)[0]}" y1="${iso(0, y)[1]}" x2="${iso(0, y, 2.6)[0]}" y2="${iso(0, y, 2.6)[1]}" stroke="#4d2e18" stroke-width="1"/>`;
  out += `<polyline points="${pts(iso(0, 2.45, 0.6), iso(0, 3.75, 1.9))}" stroke="#4d2e18" stroke-width="5"/>`;
  out += `<circle cx="${iso(0, 3.6, 1.25)[0]}" cy="${iso(0, 3.6, 1.25)[1]}" r="3" fill="#d7a640"/>`;
  return out;
}

function waterBarrel(): string {
  const { x, y, r, h } = POS.water;
  const bucket = (bx: number, by: number) =>
    cylinder(bx, by, 0, 0.22, 0.38, "#8d8f8c") + hoop(bx, by, 0.3, 0.22, "#5c5e5b", 2) + ellipseAt(bx, by, 0.38, 0.22, "#5c5e5b", 'stroke="#2b1a10"') + ellipseAt(bx, by, 0.36, 0.17, "#4aa3c7");
  return `<g class="hit" data-station="water" tabindex="0" role="button" aria-label="Water barrel">
    <g class="lift">${barrel(x, y, r, h, "water-in", ellipseAt(x, y, h - 0.06, r * 0.8, "#4aa3c7", 'id="water-level"'))}${bucket(1.9, 5.85)}</g>
  </g>`;
}

function mashBarrel(i: number): string {
  const { x, y, r, h } = POS.barrels[i]!;
  const [cx, cy] = iso(x, y, h);
  const bubbles = [-0.45, -0.1, 0.25, 0.5]
    .map((f, k) => `<circle class="bubble" style="--d:${(k * 0.37).toFixed(2)}s" cx="${cx + f * ell(r).rx}" cy="${cy + (k % 2 ? 2 : -3)}" r="${2.5 + (k % 2)}" fill="#f4e7bf" stroke="#9a7434" stroke-width=".8"/>`)
    .join("");
  const steam = [-14, 6, 20]
    .map((dx, k) => `<path class="steam" style="--d:${(k * 0.6).toFixed(1)}s" d="M${cx + dx},${cy - 8} c-6,-8 6,-14 0,-22 c-6,-8 6,-14 0,-22" fill="none" stroke="#f3efe6" stroke-width="3" stroke-linecap="round"/>`)
    .join("");
  const inner = ellipseAt(x, y, h - 0.08, r * 0.82, "#e9d38a", 'data-role="mash"') + `<g data-role="bubbles">${bubbles}</g><g data-role="steam">${steam}</g>`;
  const paddle = i === 0 ? `<polyline points="${pts(iso(x + 0.2, y - 0.2, h - 0.2), iso(x + 0.55, y - 0.6, h + 1.1))}" stroke="#9c6a3c" stroke-width="5" stroke-linecap="round"/>` : "";
  return `<g class="hit" data-station="barrel-${i}" tabindex="0" role="button" aria-label="Mash barrel ${i + 1}">
    <g class="lift">${barrel(x, y, r, h, `barrel-${i}-in`, inner)}${paddle}</g>
  </g>`;
}

function still(): string {
  const { pot, thumper: th, worm } = POS;
  const [px, ptop] = iso(pot.x, pot.y, pot.z + pot.h);
  const { rx: prx, ry: pry } = ell(pot.r);
  const dome = `<path d="M${px - prx},${ptop} A${prx},${pry * 1.9} 0 0 1 ${px + prx},${ptop} A${prx},${pry} 0 0 1 ${px - prx},${ptop} Z" fill="url(#copper)" stroke="#2b1a10" stroke-width="1.5"/>`;
  const neckTop = ptop - pry * 1.9 - 14;
  const neck = `<rect x="${px - 7}" y="${neckTop}" width="14" height="${pry * 1.9 - 2 + 14}" fill="url(#copper)" stroke="#2b1a10" stroke-width="1.5"/><ellipse cx="${px}" cy="${neckTop}" rx="7" ry="3.5" fill="#c66f35" stroke="#2b1a10" stroke-width="1.2"/>`;
  const [tx, ttop] = iso(th.x, th.y, th.h);
  const [wx, wtop] = iso(worm.x, worm.y, worm.h);
  const pipe = (d: string) => `<path d="${d}" fill="none" stroke="#2b1a10" stroke-width="8" stroke-linecap="round"/><path d="${d}" fill="none" stroke="#d98547" stroke-width="5" stroke-linecap="round"/>`;
  const arm = pipe(`M${px},${neckTop + 3} C${px + 30},${neckTop - 22} ${tx - 10},${ttop - 40} ${tx},${ttop - 4}`);
  const arm2 = pipe(`M${tx + 4},${ttop - 2} C${tx + 14},${ttop - 34} ${wx + 10},${wtop - 36} ${wx},${wtop - 4}`);
  const [wcx, wcy] = iso(worm.x, worm.y, 0.4);
  const [sx, sy] = [wcx - ell(worm.r).rx + 6, wcy + ell(worm.r).ry * 0.6];
  const sj = POS.spoutJar;
  const [jx, jy] = iso(sj.x, sj.y, 0);
  const spout = pipe(`M${sx},${sy} L${jx + 3},${jy - 28}`);
  const fireBox = box(pot.x - 0.72, pot.y - 0.72, 0, 1.44, 1.44, pot.z, "#7d746b", "url(#stoneL)", "url(#stoneR)");
  const [fx, fy] = iso(pot.x - 0.05, pot.y + 0.72, 0.05);
  const fire = `<g transform="translate(${fx},${fy}) skewY(-27)">
      <path d="M-15,0 L-15,-14 Q-15,-24 0,-24 Q15,-24 15,-14 L15,0 Z" fill="#1c120c"/>
      <g id="fire" class="fire"><path d="M-11,0 C-13,-8 -6,-11 -6,-19 C-1,-14 1,-10 1,-6 C3,-11 6,-13 6,-17 C10,-11 13,-6 11,0 Z" fill="#ff8a1f"/>
      <path d="M-6,0 C-7,-5 -3,-7 -2,-12 C1,-8 3,-6 4,-2 C5,-4 6,-6 7,-8 C8,-4 8,-2 7,0 Z" fill="#ffd24a"/></g>
    </g>`;
  const steam = [-10, 8]
    .map((dx, k) => `<path class="steam" style="--d:${(k * 0.8).toFixed(1)}s" d="M${px + dx},${neckTop - 6} c-5,-7 5,-12 0,-19 c-5,-7 5,-12 0,-19" fill="none" stroke="#f3efe6" stroke-width="3" stroke-linecap="round"/>`)
    .join("");
  const drip = `<circle id="drip" class="drip" cx="${jx + 2}" cy="${jy - 27}" r="2.4" fill="#f3ecc8" stroke="#8b8467" stroke-width=".6"/>`;
  const coil = [0.25, 0.5, 0.75]
    .map((f) => hoop(worm.x, worm.y, worm.h * f, worm.r + 0.03, "#b8642c", 3))
    .join("");
  return `<g class="hit" data-station="still" tabindex="0" role="button" aria-label="The still">
    <g class="lift">
      <ellipse cx="${iso(pot.x, pot.y)[0]}" cy="${iso(pot.x, pot.y)[1] + 6}" rx="70" ry="34" fill="#2b1a10" opacity=".28"/>
      ${fireBox}${fire}
      ${cylinder(pot.x, pot.y, pot.z, pot.r, pot.h, "url(#copper)")}${hoop(pot.x, pot.y, pot.z + 0.25, pot.r, "#8a4420", 2)}${dome}${neck}
      <g id="pot-steam">${steam}</g>
      ${barrel(th.x, th.y, th.r, th.h, "thumper-in", "")}
      ${arm}
      ${barrel(worm.x, worm.y, worm.r, worm.h, "worm-in", ellipseAt(worm.x, worm.y, worm.h - 0.06, worm.r * 0.8, "#3f7f9a"))}${coil}
      ${arm2}
      ${spout}
      ${jar(sj.x, sj.y, 0, "spout-jar", 1.2)}
      ${drip}
    </g>
  </g>`;
}

const DEFS = `<defs>
  <linearGradient id="wood" x1="0" x2="1"><stop offset="0" stop-color="#5b3519"/><stop offset=".45" stop-color="#b07a45"/><stop offset=".6" stop-color="#a36d3b"/><stop offset="1" stop-color="#4e2d15"/></linearGradient>
  <linearGradient id="copper" x1="0" x2="1"><stop offset="0" stop-color="#7a3416"/><stop offset=".35" stop-color="#e3894a"/><stop offset=".5" stop-color="#ffc28a"/><stop offset=".7" stop-color="#cf7337"/><stop offset="1" stop-color="#6b2c12"/></linearGradient>
  <radialGradient id="burlap" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="#e0ba7a"/><stop offset="1" stop-color="#a67a3e"/></radialGradient>
  <radialGradient id="sugarcloth" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="#fffaf0"/><stop offset="1" stop-color="#cfc6b2"/></radialGradient>
  <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7c5131"/><stop offset="1" stop-color="#9a6a40"/></linearGradient>
  <linearGradient id="wallL" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5e3d24"/><stop offset="1" stop-color="#7d5535"/></linearGradient>
  <linearGradient id="wallR" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6f4a2c"/><stop offset="1" stop-color="#93683f"/></linearGradient>
  <linearGradient id="stoneL" x1="0" x2="1"><stop offset="0" stop-color="#6a625a"/><stop offset="1" stop-color="#857b70"/></linearGradient>
  <linearGradient id="stoneR" x1="0" x2="1"><stop offset="0" stop-color="#5a524b"/><stop offset="1" stop-color="#6e655c"/></linearGradient>
  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop id="sky-top" offset="0" stop-color="#7fb7e0"/><stop id="sky-bot" offset="1" stop-color="#f4d9a6"/></linearGradient>
  <radialGradient id="glow"><stop offset="0" stop-color="#ffcf73" stop-opacity=".75"/><stop offset=".5" stop-color="#ff9e3d" stop-opacity=".25"/><stop offset="1" stop-color="#ff9e3d" stop-opacity="0"/></radialGradient>
  <radialGradient id="fireglow"><stop offset="0" stop-color="#ff8a2a" stop-opacity=".7"/><stop offset="1" stop-color="#ff8a2a" stop-opacity="0"/></radialGradient>
</defs>`;

export const VIEWBOX = { x: -380, y: -215, w: 820, h: 660 };

export function sceneSVG(): string {
  const [lx, ly] = iso(4.6, 4.2, ROOM.h - 0.35);
  const lantern = `<g id="lantern"><line x1="${lx}" y1="${ly}" x2="${lx}" y2="${ly + 34}" stroke="#2b1a10" stroke-width="2"/>
    <rect x="${lx - 9}" y="${ly + 34}" width="18" height="24" rx="4" fill="#ffd27a" stroke="#2b1a10" stroke-width="2"/>
    <path d="M${lx - 11},${ly + 34} L${lx + 11},${ly + 34} L${lx + 6},${ly + 28} L${lx - 6},${ly + 28} Z" fill="#3a3330"/>
    <rect x="${lx - 11}" y="${ly + 57}" width="22" height="4" rx="2" fill="#3a3330"/></g>`;
  const corn = CORN.map(([x, y, z], k) => sack("corn", x, y, z, `corn-${k}`)).join("");
  const sugar = SUGAR.map(([x, y, z], k) => sack("sugar", x, y, z, `sugar-${k}`)).join("");
  const { x: vx, y: vy, w: vw, h: vh } = VIEWBOX;
  const [fgx, fgy] = iso(POS.pot.x, POS.pot.y + 0.8, 0.2);
  return `<svg id="scene" viewBox="${vx} ${vy} ${vw} ${vh}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
    ${DEFS}
    <g id="world">
      ${room()}
      <g class="hit" data-station="shelf" tabindex="0" role="button" aria-label="Jar shelf"><g class="lift">${shelf()}</g></g>
      <g class="hit" data-station="pantry" tabindex="0" role="button" aria-label="Corn and sugar"><g class="lift">${corn}${sugar}</g></g>
      ${waterBarrel()}
      ${mashBarrel(0)}
      ${still()}
      ${mashBarrel(1)}
      ${lantern}
    </g>
    <rect id="night" x="${vx}" y="${vy}" width="${vw}" height="${vh}" fill="#141c3a" opacity="0" pointer-events="none"/>
    <circle cx="${lx}" cy="${ly + 46}" r="260" fill="url(#glow)" id="lamp-glow" pointer-events="none"/>
    <circle cx="${fgx}" cy="${fgy}" r="120" fill="url(#fireglow)" id="fire-glow" pointer-events="none" opacity="0"/>
    <g id="signs" pointer-events="none">
      ${sign("sign-barrel-0", POS.barrels[0]!.x, POS.barrels[0]!.y, POS.barrels[0]!.h + 0.95, "Barrel 1")}
      ${sign("sign-barrel-1", POS.barrels[1]!.x, POS.barrels[1]!.y, POS.barrels[1]!.h + 0.95, "Barrel 2")}
      ${sign("sign-still", POS.pot.x + 0.1, POS.pot.y, POS.pot.z + POS.pot.h + 1.9, "The still")}
      ${sign("sign-water", POS.water.x, POS.water.y, POS.water.h + 0.8, "Water")}
    </g>
  </svg>`;
}

const $ = <E extends Element>(root: ParentNode, sel: string) => root.querySelector<E>(sel)!;

function setSign(root: ParentNode, id: string, status: string, p: number | null, alert = false): void {
  const g = $<SVGGElement>(root, `#${id}`);
  $(g, '[data-role="status"]').textContent = status;
  const bar = $(g, '[data-role="bar"]');
  const track = $(g, '[data-role="track"]');
  bar.setAttribute("width", String(p === null ? 0 : Math.round(106 * p)));
  track.setAttribute("opacity", p === null ? "0" : "1");
  g.classList.toggle("alert", alert);
}

function lerp(a: string, b: string, t: number): string {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return "#" + pa.map((v, i) => Math.round(v + (pb[i]! - v) * t).toString(16).padStart(2, "0")).join("");
}

/** 0 at noon, 1 in the dead of night. */
export function darkness(hour: number): number {
  if (hour >= 7 && hour <= 17) return 0;
  if (hour >= 20 || hour <= 4) return 1;
  return hour < 12 ? (7 - hour) / 3 : (hour - 17) / 3;
}

export function updateScene(root: ParentNode, s: State): void {
  const hours = hourOfDay(s.clock);
  const dark = darkness(hours);
  $(root, "#night").setAttribute("opacity", (dark * 0.5).toFixed(3));
  $(root, "#lamp-glow").setAttribute("opacity", (0.35 + dark * 0.65).toFixed(3));
  $(root, "#sky-top").setAttribute("stop-color", lerp("#7fb7e0", "#0d1430", dark));
  $(root, "#sky-bot").setAttribute("stop-color", lerp("#f4d9a6", "#33416e", dark));
  const moon = $(root, "#moon");
  const [a] = iso(5.0, 0, 0);
  const [b] = iso(6.8, 0, 0);
  const t = ((hours + 18) % 24) / 24;
  const [mx, my] = iso(5.0 + 1.8 * t, 0, 2.55 - Math.sin(t * Math.PI) * 0.45);
  moon.setAttribute("cx", String(mx));
  moon.setAttribute("cy", String(my));
  moon.setAttribute("fill", dark > 0.5 ? "#f6efd4" : "#fff6c8");
  moon.setAttribute("opacity", mx > a + 6 && mx < b - 6 ? "1" : "0");

  CORN.forEach((_, k) => $(root, `#corn-${k}`).setAttribute("opacity", k < s.corn ? "1" : "0"));
  SUGAR.forEach((_, k) => $(root, `#sugar-${k}`).setAttribute("opacity", k < s.sugar ? "1" : "0"));
  for (let k = 0; k < 24; k++) $(root, `#jar-${k}`).setAttribute("opacity", k < s.jars ? "1" : "0");

  const wl = $(root, "#water-level");
  const fill = s.water / RULES.waterCap;
  wl.setAttribute("opacity", fill > 0 ? "1" : "0");
  const { r, h, x, y } = POS.water;
  wl.setAttribute("cy", String(iso(x, y, h - 0.08 - (1 - fill) * 0.5)[1]));
  wl.setAttribute("rx", String(ell(r * 0.82).rx));
  setSign(root, "sign-water", s.haul ? "Hauling from the creek" : `${s.water} of ${RULES.waterCap} gal`, s.haul ? progress(s.haul.from, s.haul.until, s.clock) : s.water / RULES.waterCap, false);

  s.barrels.forEach((bar, i) => {
    const g = $<SVGGElement>(root, `#barrel-${i}-in`);
    g.dataset.status = bar.status;
    const mash = $(g, '[data-role="mash"]');
    const color = { empty: "#2e1b0f", cooking: "#e3c77a", working: "#c9a256", ready: "#9c6a2a" }[bar.status];
    mash.setAttribute("fill", color);
    const [status, p] =
      bar.status === "empty"
        ? ["Empty", null]
        : bar.status === "cooking"
          ? ["Cooking the mash", progress(bar.from, bar.until, s.clock)]
          : bar.status === "working"
            ? ["Fermenting", progress(bar.from, bar.until, s.clock)]
            : ["Ready to run", 1];
    setSign(root, `sign-barrel-${i}`, status, p, bar.status === "ready");
  });

  const still = s.still;
  const stillG = $<SVGGElement>(root, '[data-station="still"]');
  stillG.dataset.status = still.status;
  const running = still.status === "running";
  $(root, "#fire-glow").setAttribute("opacity", running ? "1" : "0");
  const spoutJar = $(root, "#spout-jar .shine");
  const jarFill = running ? ((progress(still.from, still.until, s.clock) * RULES.jarsPerRun) % 1) : 0;
  spoutJar.setAttribute("y", String(-0.5 - 13.5 * jarFill));
  spoutJar.setAttribute("height", String(13.5 * jarFill));
  setSign(
    root,
    "sign-still",
    still.status === "cold" ? "Cold and empty" : still.status === "loaded" ? "Full. Light the fire" : `Running, jar ${Math.min(still.jars + 1, RULES.jarsPerRun)} of ${RULES.jarsPerRun}`,
    running ? progress(still.from, still.until, s.clock) : null,
    still.status === "loaded",
  );
}
