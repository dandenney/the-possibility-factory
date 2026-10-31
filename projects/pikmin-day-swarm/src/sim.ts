import type { SproutType } from "./types.ts";

export type SproutState = "idle" | "follow" | "flight" | "carry" | "charge";

export interface Sprout {
  id: number;
  type: SproutType;
  x: number;
  y: number;
  /** Height above the ground while airborne. */
  z: number;
  state: SproutState;
  /** Flight: from, to, elapsed, duration, peak height. */
  fx: number; fy: number; tx: number; ty: number; t: number; dur: number; peak: number;
  item?: Item;
  slot: number;
  age: number;
  face: number;
  phase: number;
}

export type ItemKind = "crumb" | "cookie" | "berry" | "pellet" | "candy";

export interface Item {
  id: number;
  kind: ItemKind;
  x: number;
  y: number;
  r: number;
  /** Carrier units needed to lift it. */
  weight: number;
  /** Sprouts the onion makes from it. */
  value: number;
  color: string;
  carriers: Sprout[];
  moving: boolean;
}

export interface Puddle { x: number; y: number; rx: number; ry: number }

export interface Popup { x: number; y: number; text: string; t: number }

const BASE_SPEED = 118;
const LEADER_SPEED = 240;
const LEASH = 64;
const THROW_RANGE = 300;
const MAX_SPROUTS = 650;
const SPROUT_R = 5;

/** Deterministic PRNG so tests (and screenshots) are repeatable. */
export function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const strengthOf = (carriers: Sprout[]) => carriers.reduce((s, c) => s + c.type.strength, 0);

/** Growth: leaf → bud → flower. Flowers walk a little faster. */
export const stageOf = (age: number) => (age > 90 ? 2 : age > 35 ? 1 : 0);

export class World {
  sprouts: Sprout[] = [];
  items: Item[] = [];
  puddles: Puddle[] = [];
  popups: Popup[] = [];
  onion = { x: 0, y: 0, r: 34, pile: 0, pulse: 0 };
  leader = { x: 0, y: 0, aimX: 0, aimY: 0, whistling: false, face: 0 };
  delivered = 0;
  private nextId = 1;
  private rand: () => number;
  private spawnClock = 0;

  constructor(
    public width: number,
    public height: number,
    seed = 1,
  ) {
    this.rand = mulberry32(seed);
    this.layout();
  }

  private layout() {
    const { width: w, height: h } = this;
    this.onion.x = w * 0.5;
    this.onion.y = h * 0.52;
    this.leader.x = this.leader.aimX = this.onion.x;
    this.leader.y = this.leader.aimY = this.onion.y + 90;
    const area = (w * h) / (1200 * 800);
    const count = Math.max(1, Math.round(2 * Math.sqrt(area)));
    this.puddles = [];
    for (let i = 0; i < count; i++) {
      for (let tries = 0; tries < 40; tries++) {
        const rx = 70 + this.rand() * 60, ry = 45 + this.rand() * 30;
        const x = rx + 20 + this.rand() * (w - 2 * rx - 40), y = ry + 70 + this.rand() * (h - 2 * ry - 140);
        if (Math.hypot(x - this.onion.x, y - this.onion.y) < rx + 120) continue;
        if (this.puddles.some((p) => Math.hypot(p.x - x, p.y - y) < p.rx + rx + 30)) continue;
        this.puddles.push({ x, y, rx, ry });
        break;
      }
    }
    this.items = [];
    this.topUpItems(true);
  }

  resize(width: number, height: number) {
    const sx = width / this.width, sy = height / this.height;
    const scale = <T extends { x: number; y: number }>(o: T) => { o.x *= sx; o.y *= sy; };
    [this.onion, ...this.items, ...this.puddles, ...this.sprouts, ...this.popups].forEach(scale);
    for (const s of this.sprouts) { s.fx *= sx; s.fy *= sy; s.tx *= sx; s.ty *= sy; }
    this.leader.x *= sx; this.leader.y *= sy; this.leader.aimX *= sx; this.leader.aimY *= sy;
    this.width = width;
    this.height = height;
  }

  inPuddle(x: number, y: number, pad = 0): Puddle | undefined {
    return this.puddles.find((p) => ((x - p.x) / (p.rx + pad)) ** 2 + ((y - p.y) / (p.ry + pad)) ** 2 < 1);
  }

  /** Push a point to just outside the puddle it's in. */
  private shore(p: Puddle, x: number, y: number): [number, number] {
    const a = Math.atan2((y - p.y) / p.ry, (x - p.x) / p.rx);
    return [p.x + Math.cos(a) * (p.rx + 3), p.y + Math.sin(a) * (p.ry + 3)];
  }

  // ---------- Items ----------

  private topUpItems(initial = false) {
    const target = Math.max(8, Math.round((this.width * this.height) / 60_000));
    let guard = 0;
    while (this.items.length < target && guard++ < 200) {
      const roll = this.rand();
      const kind: ItemKind = roll < 0.4 ? "crumb" : roll < 0.62 ? "berry" : roll < 0.8 ? "cookie" : roll < 0.93 ? "pellet" : "candy";
      const spec = {
        crumb: { weight: 1, value: 2, r: 7, color: "#d9a35b" },
        berry: { weight: 2, value: 3, r: 10, color: "#d6263b" },
        cookie: { weight: 5, value: 6, r: 17, color: "#c98a46" },
        pellet: { weight: 10, value: 12, r: 20, color: ["#e5372c", "#f5c518", "#2f6fe0"][(this.rand() * 3) | 0]! },
        candy: { weight: 20, value: 25, r: 26, color: "#ff7518" },
      }[kind];
      // Some pellets and berries sit in puddles, so only swimmers can fetch them.
      const wet = (kind === "pellet" || kind === "berry") && this.puddles.length > 0 && this.rand() < 0.35;
      let x: number, y: number;
      if (wet) {
        const p = this.puddles[(this.rand() * this.puddles.length) | 0]!;
        x = p.x + (this.rand() - 0.5) * p.rx * 0.9;
        y = p.y + (this.rand() - 0.5) * p.ry * 0.9;
      } else {
        const m = spec.r * 2 + 12;
        x = m + this.rand() * (this.width - 2 * m);
        y = 80 + m + this.rand() * (this.height - 190 - 2 * m);
        if (this.inPuddle(x, y, spec.r)) continue;
      }
      if (Math.hypot(x - this.onion.x, y - this.onion.y) < 150) continue;
      if (this.items.some((o) => Math.hypot(o.x - x, o.y - y) < o.r + spec.r + 18)) continue;
      if (!initial && Math.hypot(x - this.leader.x, y - this.leader.y) < 80) continue;
      this.items.push({ id: this.nextId++, kind, x, y, ...spec, carriers: [], moving: false });
    }
  }

  // ---------- Sprouts ----------

  spawnSprouts(type: SproutType, count: number, fromOnion = true) {
    for (let i = 0; i < count && this.sprouts.length < MAX_SPROUTS; i++) {
      const a = this.rand() * Math.PI * 2;
      const d = 55 + this.rand() * 80;
      const x = this.onion.x, y = this.onion.y;
      const s: Sprout = {
        id: this.nextId++, type, x, y, z: 0, state: "idle",
        fx: x, fy: y, tx: x + Math.cos(a) * d, ty: y + Math.sin(a) * d * 0.8, t: 0, dur: 0.7 + this.rand() * 0.4, peak: 60,
        slot: 0, age: 0, face: a, phase: this.rand() * 10,
      };
      if (fromOnion) {
        s.state = "flight";
        s.t = -i * 0.04; // stagger the pops
      } else {
        s.x = s.tx;
        s.y = s.ty;
      }
      const wet = this.inPuddle(s.tx, s.ty);
      if (wet && !type.swims) [s.tx, s.ty] = this.shore(wet, s.tx, s.ty);
      this.sprouts.push(s);
    }
  }

  followers(typeId?: string): Sprout[] {
    return this.sprouts.filter((s) => s.state === "follow" && (!typeId || s.type.id === typeId));
  }

  private aimPoint(range: number): [number, number] {
    const { leader } = this;
    const dx = leader.aimX - leader.x, dy = leader.aimY - leader.y;
    const d = Math.hypot(dx, dy);
    const max = THROW_RANGE * range;
    return d <= max ? [leader.aimX, leader.aimY] : [leader.x + (dx / d) * max, leader.y + (dy / d) * max];
  }

  /** Throw the follower nearest the leader at the aim point. */
  throwOne(typeId?: string): Sprout | undefined {
    let best: Sprout | undefined;
    let bestD = Infinity;
    for (const s of this.followers(typeId)) {
      const d = Math.hypot(s.x - this.leader.x, s.y - this.leader.y);
      if (d < bestD) { bestD = d; best = s; }
    }
    if (!best) return undefined;
    const [tx, ty] = this.aimPoint(best.type.throwRange);
    Object.assign(best, {
      state: "flight", fx: this.leader.x, fy: this.leader.y, tx, ty, t: 0,
      dur: 0.35 + Math.hypot(tx - this.leader.x, ty - this.leader.y) / 900,
      peak: 50 + 40 * best.type.throwRange,
    });
    best.x = this.leader.x;
    best.y = this.leader.y;
    return best;
  }

  /** Send every follower running at the aim point. */
  charge(): number {
    const f = this.followers();
    for (const s of f) s.state = "charge";
    return f.length;
  }

  dismiss() {
    for (const s of this.followers()) s.state = "idle";
  }

  private tryGrab(s: Sprout, reach = 14): boolean {
    for (const item of this.items) {
      if (item.carriers.length >= item.weight * 2 + 2) continue;
      if (Math.hypot(s.x - item.x, s.y - item.y) > item.r + reach) continue;
      if (this.inPuddle(item.x, item.y) && !s.type.swims) continue;
      item.carriers.push(s);
      s.item = item;
      s.state = "carry";
      return true;
    }
    return false;
  }

  private drop(s: Sprout) {
    if (s.item) s.item.carriers = s.item.carriers.filter((c) => c !== s);
    s.item = undefined;
    s.state = "idle";
  }

  // ---------- Step ----------

  update(dt: number) {
    dt = Math.min(dt, 0.05);
    const { leader, onion } = this;

    // Leader walks toward the aim and stops a leash-length short.
    const ldx = leader.aimX - leader.x, ldy = leader.aimY - leader.y;
    const ld = Math.hypot(ldx, ldy);
    if (ld > LEASH) {
      const step = Math.min(ld - LEASH, LEADER_SPEED * dt);
      leader.x += (ldx / ld) * step;
      leader.y += (ldy / ld) * step;
      leader.face = Math.atan2(ldy, ldx);
    }
    leader.x = Math.max(10, Math.min(this.width - 10, leader.x));
    leader.y = Math.max(10, Math.min(this.height - 10, leader.y));

    const followerCount = this.sprouts.reduce((n, s) => n + (s.state === "follow" ? 1 : 0), 0);
    const blob = 26 + Math.sqrt(followerCount) * 6.5;
    const whistleR = 150;

    // Spatial hash for separation.
    const cell = 14;
    const grid = new Map<number, Sprout[]>();
    const key = (x: number, y: number) => ((x / cell) | 0) * 10007 + ((y / cell) | 0);
    for (const s of this.sprouts) {
      if (s.state === "flight" || s.state === "carry") continue;
      const k = key(s.x, s.y);
      const bucket = grid.get(k);
      if (bucket) bucket.push(s); else grid.set(k, [s]);
    }

    for (const s of this.sprouts) {
      s.age += dt;
      const speed = BASE_SPEED * s.type.speed * (stageOf(s.age) === 2 ? 1.2 : 1);

      if (leader.whistling && s.state !== "flight" && Math.hypot(s.x - leader.x, s.y - leader.y) < whistleR) {
        if (s.state === "carry") this.drop(s);
        s.state = "follow";
      }

      if (s.state === "flight") {
        s.t += dt;
        if (s.t < 0) continue;
        const u = Math.min(1, s.t / s.dur);
        s.x = s.fx + (s.tx - s.fx) * u;
        s.y = s.fy + (s.ty - s.fy) * u;
        s.z = 4 * s.peak * u * (1 - u);
        s.face = Math.atan2(s.ty - s.fy, s.tx - s.fx);
        if (u >= 1) {
          s.z = 0;
          s.state = "idle";
          const wet = this.inPuddle(s.x, s.y);
          if (!this.tryGrab(s, 16) && wet && !s.type.swims) [s.x, s.y] = this.shore(wet, s.x, s.y);
        }
        continue;
      }

      if (s.state === "carry") continue; // positioned with their item below

      let vx = 0, vy = 0;
      if (s.state === "follow") {
        const bx = leader.x - Math.cos(leader.face) * blob * 0.55;
        const by = leader.y - Math.sin(leader.face) * blob * 0.55;
        const dx = bx - s.x, dy = by - s.y;
        const d = Math.hypot(dx, dy);
        if (d > blob * 0.45) {
          const k = Math.min(1, (d - blob * 0.45) / 30);
          vx = (dx / d) * speed * k;
          vy = (dy / d) * speed * k;
        }
      } else if (s.state === "charge") {
        const dx = leader.aimX - s.x, dy = leader.aimY - s.y;
        const d = Math.hypot(dx, dy);
        if (this.tryGrab(s, 10)) continue;
        if (d < 12) s.state = "idle";
        else { vx = (dx / d) * speed * 1.3; vy = (dy / d) * speed * 1.3; }
      } else {
        // Idle: plant, maybe wander, rejoin when the leader brushes past, grab nearby items.
        if (Math.hypot(s.x - leader.x, s.y - leader.y) < 34) s.state = "follow";
        else if (s.age > 1 && ((s.id + Math.floor(s.age * 2)) % 9 === 0) && this.tryGrab(s, 22)) continue;
      }
      if (s.type.wander || s.state === "idle") {
        const w = s.type.wander ? 40 : 6;
        vx += Math.cos(s.phase + s.age * 1.7) * w;
        vy += Math.sin(s.phase * 1.3 + s.age * 1.3) * w;
      }

      // Separation from neighbors.
      const k0 = key(s.x, s.y);
      const r = SPROUT_R * 2 * Math.max(0.8, s.type.size);
      for (let ox = -1; ox <= 1; ox++) {
        for (let oy = -1; oy <= 1; oy++) {
          const bucket = grid.get(k0 + ox * 10007 + oy);
          if (!bucket) continue;
          for (const o of bucket) {
            if (o === s) continue;
            const dx = s.x - o.x, dy = s.y - o.y;
            const d2 = dx * dx + dy * dy;
            if (d2 > 0 && d2 < r * r) {
              const d = Math.sqrt(d2);
              const push = ((r - d) / r) * 90;
              vx += (dx / d) * push;
              vy += (dy / d) * push;
            }
          }
        }
      }

      s.x += vx * dt;
      s.y += vy * dt;
      if (vx * vx + vy * vy > 100) s.face = Math.atan2(vy, vx);
      const wet = this.inPuddle(s.x, s.y);
      if (wet && !s.type.swims) [s.x, s.y] = this.shore(wet, s.x, s.y);
      s.x = Math.max(4, Math.min(this.width - 4, s.x));
      s.y = Math.max(4, Math.min(this.height - 4, s.y));
    }

    // Items: carry home when strong enough. Non-swimmers let go at the water's edge.
    for (const item of this.items) {
      const strength = strengthOf(item.carriers);
      item.moving = strength >= item.weight;
      if (item.moving) {
        const dx = onion.x - item.x, dy = onion.y - item.y;
        const d = Math.hypot(dx, dy);
        const slowest = Math.min(...item.carriers.map((c) => c.type.speed));
        const v = 38 * Math.min(2, strength / item.weight) * slowest * (40 / (30 + item.r));
        const nx = item.x + (dx / d) * v * dt, ny = item.y + (dy / d) * v * dt;
        if (this.inPuddle(nx, ny, 4)) {
          for (const c of [...item.carriers]) {
            if (!c.type.swims) {
              this.drop(c);
              const p = this.inPuddle(c.x, c.y, 2);
              if (p) [c.x, c.y] = this.shore(p, c.x, c.y);
            }
          }
          if (strengthOf(item.carriers) < item.weight) continue;
        }
        item.x = nx;
        item.y = ny;
      }
      const n = item.carriers.length;
      item.carriers.forEach((c, i) => {
        const a = (i / n) * Math.PI * 2 + item.id;
        const tx = item.x + Math.cos(a) * (item.r + 5), ty = item.y + Math.sin(a) * (item.r + 5) * 0.8;
        c.x += (tx - c.x) * Math.min(1, dt * 10);
        c.y += (ty - c.y) * Math.min(1, dt * 10);
        c.face = Math.atan2(onion.y - c.y, onion.x - c.x);
      });
    }

    // Deliveries.
    for (const item of [...this.items]) {
      if (Math.hypot(item.x - onion.x, item.y - onion.y) > onion.r) continue;
      this.items = this.items.filter((i) => i !== item);
      const tally = new Map<SproutType, number>();
      for (const c of item.carriers) tally.set(c.type, (tally.get(c.type) ?? 0) + 1);
      const type = [...tally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
      for (const c of item.carriers) { c.item = undefined; c.state = "idle"; }
      onion.pile++;
      onion.pulse = 1;
      this.delivered++;
      if (type) {
        this.spawnSprouts(type, item.value);
        this.popups.push({ x: onion.x, y: onion.y - onion.r - 20, text: `+${item.value} ${type.name}`, t: 0 });
      }
    }

    onion.pulse = Math.max(0, onion.pulse - dt * 2);
    for (const p of this.popups) { p.t += dt; p.y -= dt * 30; }
    this.popups = this.popups.filter((p) => p.t < 1.6);

    this.spawnClock += dt;
    if (this.spawnClock > 4) {
      this.spawnClock = 0;
      this.topUpItems();
    }
  }
}
