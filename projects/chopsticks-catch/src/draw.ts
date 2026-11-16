// All Canvas 2D drawing: the flight-test chart, the tower, the booster, smoke and debris.
import {
  ARMS_Y,
  BOOSTER_H,
  BOOSTER_R,
  CATCH_X,
  MOUNT_Y,
  PIN_OFFSET,
  TOWER_H,
  TOWER_HALF,
  TOWER_X,
  WINDOW,
  type World,
} from "./sim.ts";
import type { RGB } from "./gif.ts";

export const INK = "#1d1f22";
export const INK_MID = "#4d5552";
export const INK_SOFT = "#66706c";
export const PAPER = "#eef1ef";
export const PAPER_DEEP = "#e2e7e4";
export const RULE = "#cdd6d2";
export const STEEL = "#dde2e0";
export const STEEL_SHADE = "#b9c1bd";
export const ACCENT = "#d9481f";
export const ACCENT_LIGHT = "#f09a72";
export const ACCENT_PALE = "#f7d5c4";
export const SMOKE = "#c6ccc9";
export const WHITE = "#fbfcfb";

/** The replay GIF palette: every colour above, plus in-between greys for antialiased edges. */
export const GIF_PALETTE: RGB[] = [
  PAPER, PAPER_DEEP, RULE, STEEL, STEEL_SHADE, SMOKE, INK_SOFT, INK_MID, INK,
  ACCENT, ACCENT_LIGHT, ACCENT_PALE, WHITE, "#a3aba7", "#e7ebe9", "#3a3a38",
].map((hex) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]);

export const FONT = '"Barlow", system-ui, sans-serif';

export interface View {
  w: number;
  h: number;
  scale: number;
  left: number;
  bottom: number;
}

/** Fit the tower and the booster; follow the booster down until the ground comes into frame. */
export function viewFor(world: World, w: number, h: number, minWidth = 110): View {
  const scale = Math.min(h / 240, w / minWidth);
  const visW = w / scale;
  const left = CATCH_X + 6 - visW / 2;
  const top = world.y - PIN_OFFSET + BOOSTER_H + 30;
  const bottom = Math.max(-6, top - h / scale);
  return { w, h, scale, left, bottom };
}

const sx = (v: View, x: number) => (x - v.left) * v.scale;
const sy = (v: View, y: number) => v.h - (y - v.bottom) * v.scale;

interface Puff {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  grow: number;
  age: number;
  life: number;
  hot: boolean;
}

interface Shard {
  x: number;
  y: number;
  vx: number;
  vy: number;
  a: number;
  va: number;
  len: number;
}

interface Streak {
  x: number;
  y: number;
  len: number;
}

/** Particles and other purely visual state, advanced alongside the sim. */
export class Fx {
  puffs: Puff[] = [];
  shards: Shard[] = [];
  streaks: Streak[] = [];
  blast?: { x: number; y: number; age: number };
  ring?: { age: number };
  private seed = 1;
  private emitClock = 0;

  private rand(): number {
    this.seed = (this.seed * 16807) % 2147483647;
    return this.seed / 2147483647;
  }

  explode(x: number, y: number): void {
    this.blast = { x, y, age: 0 };
    for (let i = 0; i < 34; i++) {
      const a = this.rand() * Math.PI * 2;
      const s = 12 + this.rand() * 34;
      this.shards.push({ x, y, vx: Math.cos(a) * s, vy: Math.abs(Math.sin(a)) * s * 1.2, a: this.rand() * 6, va: (this.rand() - 0.5) * 12, len: 1.5 + this.rand() * 5 });
    }
    for (let i = 0; i < 40; i++) {
      const a = this.rand() * Math.PI * 2;
      const s = 3 + this.rand() * 14;
      this.puffs.push({ x, y: y + this.rand() * 10, vx: Math.cos(a) * s, vy: Math.abs(Math.sin(a)) * s + 2, r: 4 + this.rand() * 6, grow: 5 + this.rand() * 5, age: 0, life: 2.5 + this.rand() * 2.5, hot: i < 16 });
    }
  }

  caught(): void {
    this.ring = { age: 0 };
  }

  update(dt: number, w: World, v: View): void {
    const engineY = w.bottom - 1;
    if (w.throttle > 0.08 && w.phase !== "crashed") {
      this.emitClock += dt * (10 + 40 * w.throttle);
      while (this.emitClock >= 1) {
        this.emitClock -= 1;
        const spread = (this.rand() - 0.5) * 6;
        this.puffs.push({
          x: w.x + spread * 0.4,
          y: engineY - 14 * w.throttle,
          vx: w.vx * 0.5 + spread,
          vy: Math.min(w.vy, 0) * 0.4 - 22 * w.throttle,
          r: 1.5 + this.rand() * 2,
          grow: 3 + this.rand() * 3,
          age: 0,
          life: 1.2 + this.rand() * 1.2,
          hot: false,
        });
      }
    }
    for (const p of this.puffs) {
      p.age += dt;
      p.x += p.vx * dt + w.wind * 3 * dt;
      p.y += p.vy * dt;
      p.r += p.grow * dt;
      p.vx *= 1 - 1.2 * dt;
      p.vy *= 1 - 1.6 * dt;
      if (p.y < 1) {
        p.y = 1;
        p.vx += (p.vx >= 0 ? 1 : -1) * Math.abs(p.vy) * 0.8;
        p.vy = 0;
      }
      if (p.y < MOUNT_Y + 1 && p.y > MOUNT_Y - 3 && Math.abs(p.x - CATCH_X) < 12 && p.vy < 0) {
        p.vx += (p.x >= CATCH_X ? 1 : -1) * Math.abs(p.vy) * 0.8;
        p.vy = 0;
      }
    }
    this.puffs = this.puffs.filter((p) => p.age < p.life);
    if (this.puffs.length > 420) this.puffs.splice(0, this.puffs.length - 420);
    for (const s of this.shards) {
      s.vy -= 9.81 * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.a += s.va * dt;
      if (s.y < 0) {
        s.y = 0;
        s.vy *= -0.25;
        s.vx *= 0.6;
        s.va *= 0.5;
      }
    }
    if (this.blast) this.blast.age += dt;
    if (this.ring) this.ring.age += dt;

    const visW = v.w / v.scale;
    const visH = v.h / v.scale;
    while (this.streaks.length < 16) {
      this.streaks.push({ x: v.left + this.rand() * visW, y: v.bottom + this.rand() * visH, len: 5 + this.rand() * 12 });
    }
    for (const s of this.streaks) {
      s.x += w.wind * 14 * dt;
      if (s.x > v.left + visW + 20) s.x -= visW + 40;
      if (s.x < v.left - 20) s.x += visW + 40;
      if (s.y < v.bottom - 10) s.y += visH + 20;
      if (s.y > v.bottom + visH + 10) s.y -= visH + 20;
    }
  }
}

function chart(g: CanvasRenderingContext2D, v: View): void {
  g.fillStyle = PAPER;
  g.fillRect(0, 0, v.w, v.h);
  const top = v.bottom + v.h / v.scale;
  g.lineWidth = 1;
  for (let y = Math.ceil(v.bottom / 10) * 10; y < top; y += 10) {
    if (y <= 0) continue;
    const major = y % 50 === 0;
    g.strokeStyle = major ? RULE : "rgba(205, 214, 210, 0.45)";
    const py = Math.round(sy(v, y)) + 0.5;
    g.beginPath();
    g.moveTo(major ? 0 : 0, py);
    g.lineTo(v.w, py);
    g.stroke();
    if (major) {
      g.fillStyle = INK_SOFT;
      g.font = `500 ${Math.max(10, Math.min(12, v.h / 60))}px ${FONT}`;
      g.textBaseline = "bottom";
      g.textAlign = "left";
      g.fillText(`${y} m`, 10, py - 3);
    }
  }
}

function streaks(g: CanvasRenderingContext2D, v: View, fx: Fx, wind: number): void {
  g.strokeStyle = INK_SOFT;
  g.globalAlpha = Math.min(0.45, 0.15 + Math.abs(wind) * 0.3);
  g.lineWidth = 1;
  g.setLineDash([6, 5]);
  for (const s of fx.streaks) {
    const x = sx(v, s.x);
    const y = Math.round(sy(v, s.y)) + 0.5;
    const len = s.len * v.scale * (0.5 + Math.abs(wind));
    g.beginPath();
    g.moveTo(x - len / 2, y);
    g.lineTo(x + len / 2, y);
    g.stroke();
  }
  g.setLineDash([]);
  g.globalAlpha = 1;
}

function ground(g: CanvasRenderingContext2D, v: View): void {
  const y0 = sy(v, 0);
  if (y0 > v.h + 4) return;
  g.fillStyle = PAPER_DEEP;
  g.fillRect(0, y0, v.w, v.h - y0);
  g.strokeStyle = RULE;
  g.lineWidth = 1;
  g.beginPath();
  for (let x = -((v.left * v.scale) % 9); x < v.w; x += 9) {
    g.moveTo(x, y0 + 4);
    g.lineTo(x - 5, y0 + 10);
  }
  g.stroke();
  g.strokeStyle = INK;
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(0, y0);
  g.lineTo(v.w, y0);
  g.stroke();
}

function mount(g: CanvasRenderingContext2D, v: View): void {
  const s = v.scale;
  const lw = Math.max(1, s * 0.3);
  g.strokeStyle = INK;
  g.lineWidth = lw;
  g.fillStyle = PAPER_DEEP;
  for (const lx of [-11, -4, 4]) {
    const x = sx(v, CATCH_X + lx);
    g.fillRect(x - 1.2 * s, sy(v, MOUNT_Y - 4), 2.4 * s, (MOUNT_Y - 4) * s);
    g.strokeRect(x - 1.2 * s, sy(v, MOUNT_Y - 4), 2.4 * s, (MOUNT_Y - 4) * s);
  }
  const x0 = sx(v, CATCH_X - 12.5);
  const x1 = sx(v, CATCH_X + 9);
  g.fillRect(x0, sy(v, MOUNT_Y), x1 - x0, 4 * s);
  g.strokeRect(x0, sy(v, MOUNT_Y), x1 - x0, 4 * s);
}

function tower(g: CanvasRenderingContext2D, v: View): void {
  const s = v.scale;
  const xl = sx(v, TOWER_X - TOWER_HALF);
  const xr = sx(v, TOWER_X + TOWER_HALF);
  const yb = sy(v, 0);
  const yt = sy(v, TOWER_H);
  g.fillStyle = "rgba(226, 231, 228, 0.85)";
  g.fillRect(xl, yt, xr - xl, yb - yt);
  g.strokeStyle = INK;
  g.lineWidth = Math.max(1, s * 0.35);
  g.strokeRect(xl, yt, xr - xl, yb - yt);
  g.lineWidth = Math.max(0.6, s * 0.15);
  g.strokeStyle = INK_MID;
  g.beginPath();
  const bay = 9;
  for (let y = 0; y < TOWER_H - 0.1; y += bay) {
    const a = sy(v, y);
    const b = sy(v, Math.min(TOWER_H, y + bay));
    g.moveTo(xl, a);
    g.lineTo(xr, b);
    g.moveTo(xr, a);
    g.lineTo(xl, b);
    g.moveTo(xl, b);
    g.lineTo(xr, b);
  }
  g.stroke();
  // Lightning mast and crane stub on top.
  g.strokeStyle = INK;
  g.lineWidth = Math.max(1, s * 0.3);
  g.beginPath();
  g.moveTo(sx(v, TOWER_X + 2), yt);
  g.lineTo(sx(v, TOWER_X + 2), sy(v, TOWER_H + 16));
  g.moveTo(sx(v, TOWER_X - 3), yt);
  g.lineTo(sx(v, TOWER_X - 3), sy(v, TOWER_H + 7));
  g.lineTo(sx(v, TOWER_X + 9), sy(v, TOWER_H + 7));
  g.stroke();
}

function arm(g: CanvasRenderingContext2D, v: View, angle: number, front: boolean): void {
  const s = v.scale;
  const hx = sx(v, TOWER_X - TOWER_HALF);
  const hy = sy(v, ARMS_Y);
  const len = 30 * s;
  const depth = 2.4 * s;
  g.save();
  g.translate(hx, hy);
  g.rotate(-angle);
  g.fillStyle = front ? PAPER_DEEP : RULE;
  g.strokeStyle = front ? INK : INK_MID;
  g.lineWidth = Math.max(1, s * (front ? 0.35 : 0.25));
  g.beginPath();
  g.rect(-len, -depth / 2, len, depth);
  g.fill();
  g.stroke();
  g.lineWidth = Math.max(0.6, s * 0.15);
  g.beginPath();
  const step = depth * 1.2;
  for (let x = -len + step, up = true; x < -step / 2; x += step, up = !up) {
    g.moveTo(x - step, up ? depth / 2 : -depth / 2);
    g.lineTo(x, up ? -depth / 2 : depth / 2);
  }
  g.stroke();
  // Rail pad at the tip.
  g.fillStyle = front ? INK : INK_MID;
  g.fillRect(-len - 0.8 * s, -depth / 2 - 0.4 * s, 1.6 * s, depth + 0.8 * s);
  g.restore();
}

function carriage(g: CanvasRenderingContext2D, v: View): void {
  const s = v.scale;
  const x = sx(v, TOWER_X - TOWER_HALF - 1.5);
  g.fillStyle = PAPER_DEEP;
  g.strokeStyle = INK;
  g.lineWidth = Math.max(1, s * 0.3);
  g.fillRect(x, sy(v, ARMS_Y + 5), 3 * s, 10 * s);
  g.strokeRect(x, sy(v, ARMS_Y + 5), 3 * s, 10 * s);
}

function catchWindow(g: CanvasRenderingContext2D, v: View, w: World, now: number): void {
  const s = v.scale;
  const x = sx(v, CATCH_X - 19);
  const y0 = sy(v, ARMS_Y);
  const y1 = sy(v, ARMS_Y + WINDOW);
  const live = w.inWindow && w.phase === "flying";
  if (live) {
    g.fillStyle = ACCENT_PALE;
    g.globalAlpha = 0.5 + 0.2 * Math.sin(now * 10);
    g.fillRect(x, y1, sx(v, TOWER_X - TOWER_HALF) - x, y0 - y1);
    g.globalAlpha = 1;
  }
  g.strokeStyle = ACCENT;
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(x + 6, y0);
  g.lineTo(x, y0);
  g.lineTo(x, y1);
  g.lineTo(x + 6, y1);
  g.stroke();
  g.fillStyle = ACCENT;
  g.font = `600 ${Math.max(10, Math.min(12, s * 4))}px ${FONT}`;
  g.textAlign = "right";
  g.textBaseline = "middle";
  g.fillText("catch", x - 6, (y0 + y1) / 2);
}

function booster(g: CanvasRenderingContext2D, v: View, w: World, now: number): void {
  const s = v.scale;
  const R = BOOSTER_R;
  g.save();
  g.translate(sx(v, w.x), sy(v, w.bottom + PIN_OFFSET));
  g.rotate(w.tilt);
  g.scale(s, s);
  // Local metres: origin at the catch pins, +y up is -y on screen.
  const top = -(BOOSTER_H - PIN_OFFSET);
  const bot = PIN_OFFSET;
  const lw = Math.max(1, s * 0.3) / s;

  if (w.throttle > 0.02) {
    const flick = 0.9 + 0.1 * Math.sin(now * 53) + 0.05 * Math.sin(now * 31);
    const len = (10 + 20 * w.throttle) * flick;
    g.fillStyle = ACCENT_LIGHT;
    g.beginPath();
    g.moveTo(-R * 0.85, bot + 1.5);
    g.quadraticCurveTo(-R * 0.7, bot + len * 0.55, 0, bot + len);
    g.quadraticCurveTo(R * 0.7, bot + len * 0.55, R * 0.85, bot + 1.5);
    g.fill();
    g.fillStyle = ACCENT;
    g.beginPath();
    g.moveTo(-R * 0.55, bot + 1.5);
    g.quadraticCurveTo(-R * 0.4, bot + len * 0.45, 0, bot + len * 0.75);
    g.quadraticCurveTo(R * 0.4, bot + len * 0.45, R * 0.55, bot + 1.5);
    g.fill();
    g.fillStyle = WHITE;
    g.beginPath();
    g.ellipse(0, bot + 2.6, R * 0.45, 1.4 + len * 0.06, 0, 0, Math.PI * 2);
    g.fill();
  }

  g.lineWidth = lw;
  g.strokeStyle = INK;
  // Engine bells.
  g.fillStyle = INK_MID;
  for (const ex of [-2.6, 0, 2.6]) {
    g.beginPath();
    g.moveTo(ex - 0.7, bot);
    g.lineTo(ex + 0.7, bot);
    g.lineTo(ex + 1.1, bot + 1.8);
    g.lineTo(ex - 1.1, bot + 1.8);
    g.closePath();
    g.fill();
  }
  // Body.
  g.fillStyle = STEEL;
  g.fillRect(-R, top, R * 2, bot - top);
  g.fillStyle = STEEL_SHADE;
  g.fillRect(R * 0.45, top, R * 0.55, bot - top);
  g.fillStyle = WHITE;
  g.globalAlpha = 0.7;
  g.fillRect(-R * 0.55, top, R * 0.22, bot - top);
  g.globalAlpha = 1;
  g.strokeStyle = STEEL_SHADE;
  g.lineWidth = lw * 0.6;
  g.beginPath();
  for (let y = top + 9; y < bot - 1; y += 7.5) {
    g.moveTo(-R, y);
    g.lineTo(R, y);
  }
  g.stroke();
  g.strokeStyle = INK;
  g.lineWidth = lw;
  g.strokeRect(-R, top, R * 2, bot - top);
  // Hot-stage ring.
  g.fillStyle = INK_MID;
  g.fillRect(-R, top, R * 2, 2.6);
  g.fillStyle = STEEL;
  for (let x = -R + 0.6; x < R - 0.4; x += 1.3) g.fillRect(x, top + 0.5, 0.55, 1.6);
  // Grid fins.
  for (const side of [-1, 1]) {
    const fx = side < 0 ? -R - 3 : R;
    g.fillStyle = PAPER_DEEP;
    g.fillRect(fx, -4.5, 3, 4);
    g.strokeRect(fx, -4.5, 3, 4);
    g.beginPath();
    for (let i = 1; i < 3; i++) {
      g.moveTo(fx + i, -4.5);
      g.lineTo(fx + i, -0.5);
    }
    g.moveTo(fx, -2.5);
    g.lineTo(fx + 3, -2.5);
    g.stroke();
  }
  // Catch pins: the part the arms grab.
  g.fillStyle = ACCENT;
  g.fillRect(-R - 1.2, 0.2, 1.2, 1.1);
  g.fillRect(R, 0.2, 1.2, 1.1);
  g.restore();
}

function puffs(g: CanvasRenderingContext2D, v: View, fx: Fx): void {
  for (const p of fx.puffs) {
    const t = p.age / p.life;
    g.globalAlpha = (1 - t) * (p.hot ? 0.8 : 0.55);
    g.fillStyle = p.hot && t < 0.35 ? (t < 0.15 ? ACCENT_LIGHT : ACCENT_PALE) : SMOKE;
    g.beginPath();
    g.arc(sx(v, p.x), sy(v, p.y), p.r * v.scale, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
}

function trail(g: CanvasRenderingContext2D, v: View, w: World): void {
  g.fillStyle = INK_SOFT;
  for (let i = 0; i < w.trail.length; i += 2) {
    const p = w.trail[i]!;
    g.globalAlpha = 0.25 + 0.5 * (i / w.trail.length);
    g.fillRect(sx(v, p.x) - 1, sy(v, p.y) - 1, 2, 2);
  }
  g.globalAlpha = 1;
}

function blast(g: CanvasRenderingContext2D, v: View, fx: Fx): void {
  const b = fx.blast;
  if (b && b.age < 1.2) {
    const t = b.age / 1.2;
    g.strokeStyle = ACCENT;
    g.globalAlpha = 1 - t;
    g.lineWidth = 2;
    g.beginPath();
    g.arc(sx(v, b.x), sy(v, b.y), (8 + 60 * Math.sqrt(t)) * v.scale, 0, Math.PI * 2);
    g.stroke();
    g.globalAlpha = 1;
  }
  g.strokeStyle = INK;
  g.lineWidth = Math.max(1, v.scale * 0.35);
  g.beginPath();
  for (const sh of fx.shards) {
    const x = sx(v, sh.x);
    const y = sy(v, sh.y);
    const dx = Math.cos(sh.a) * sh.len * v.scale * 0.5;
    const dy = Math.sin(sh.a) * sh.len * v.scale * 0.5;
    g.moveTo(x - dx, y - dy);
    g.lineTo(x + dx, y + dy);
  }
  g.stroke();
}

function ring(g: CanvasRenderingContext2D, v: View, w: World, fx: Fx): void {
  const r = fx.ring;
  if (!r || r.age > 1.6) return;
  for (const delay of [0, 0.35]) {
    const t = (r.age - delay) / 1.2;
    if (t < 0 || t > 1) continue;
    g.strokeStyle = ACCENT;
    g.globalAlpha = 1 - t;
    g.lineWidth = 1.5;
    g.beginPath();
    g.arc(sx(v, w.x), sy(v, ARMS_Y), (6 + 30 * t) * v.scale, 0, Math.PI * 2);
    g.stroke();
  }
  g.globalAlpha = 1;
}

function towerMarker(g: CanvasRenderingContext2D, v: View): void {
  if (v.bottom < TOWER_H) return;
  const x = sx(v, TOWER_X);
  const y = v.h - 18;
  g.strokeStyle = INK_SOFT;
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(x - 5, y - 4);
  g.lineTo(x, y + 1);
  g.lineTo(x + 5, y - 4);
  g.stroke();
  g.fillStyle = INK_SOFT;
  g.font = `500 12px ${FONT}`;
  g.textAlign = "center";
  g.textBaseline = "bottom";
  g.fillText(`Tower ${Math.round(v.bottom - TOWER_H)} m below`, x, y - 8);
}

export function render(g: CanvasRenderingContext2D, w: World, fx: Fx, v: View, now: number): void {
  chart(g, v);
  streaks(g, v, fx, w.wind);
  trail(g, v, w);
  ground(g, v);
  tower(g, v);
  const open = (1 - w.arms) * 0.3;
  arm(g, v, open, false);
  mount(g, v);
  catchWindow(g, v, w, now);
  puffs(g, v, fx);
  if (w.phase !== "crashed") booster(g, v, w, now);
  carriage(g, v);
  arm(g, v, -open, true);
  ring(g, v, w, fx);
  blast(g, v, fx);
  towerMarker(g, v);
}
