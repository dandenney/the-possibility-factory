// The flight model. No DOM: positions are metres, time is seconds, +y is up.
// `y` is the height of the booster's catch pins, the part the tower arms grab.

export const G = 9.81;
export const THRUST = 2.5 * G;
export const FUEL_SECONDS = 8;
export const SPOOL = 0.12;

export const BOOSTER_H = 71;
export const BOOSTER_R = 4.5;
export const PIN_OFFSET = 62;

export const TOWER_X = 0;
export const TOWER_HALF = 6;
export const TOWER_H = 146;
export const ARMS_Y = 100;
export const CATCH_X = -16;
export const WINDOW = 8;
export const MOUNT_Y = 30;
export const MOUNT_HALF = 14;
export const CLOSE_TIME = 0.45;

export const START_Y = 480;
export const MAX_CATCH_SPEED = 5;
export const MAX_CATCH_OFFSET = 5;

export type CrashReason = "hot" | "slipped" | "air" | "missed" | "tower" | "mount" | "ground";
export type Grade = "perfect" | "clean" | "rough";

export type Outcome =
  | { kind: "caught"; grade: Grade; speed: number; offset: number; score: number; fuelLeft: number }
  | { kind: "crashed"; reason: CrashReason; speed: number; offset: number };

export type Phase = "ready" | "flying" | "closing" | "falling" | "caught" | "crashed";

export type FlightEvent =
  | { type: "start" | "burn" | "window" | "fuel-low" | "fuel-out" | "closing" }
  | { type: "outcome"; outcome: Outcome };

export interface Wind {
  base: number;
  gusts: [amp: number, freq: number, phase: number][];
}

export interface Flight {
  seed: number;
  x0: number;
  vx0: number;
  vy0: number;
  wind: Wind;
}

/** mulberry32: small, fast, and good enough for flight conditions. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function flightFor(seed: number): Flight {
  const r = rng(seed * 2654435761);
  const range = (lo: number, hi: number) => lo + (hi - lo) * r();
  const sign = r() < 0.5 ? -1 : 1;
  return {
    seed,
    x0: CATCH_X + range(-26, 10),
    vx0: range(-2, 2),
    vy0: -range(46, 58),
    wind: {
      base: sign * range(0.15, 0.9),
      gusts: [
        [range(0.15, 0.45), range(0.5, 1.1), range(0, Math.PI * 2)],
        [range(0.05, 0.25), range(1.6, 2.8), range(0, Math.PI * 2)],
      ],
    },
  };
}

export function windAt(w: Wind, t: number): number {
  let a = w.base;
  for (const [amp, freq, phase] of w.gusts) a += amp * Math.sin(freq * t + phase);
  return a;
}

/** Lateral acceleration in m/s² shown to players as knots, loosely. */
export function windKnots(a: number): number {
  return Math.round(Math.abs(a) * 16);
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export class World {
  readonly flight: Flight;
  phase: Phase = "ready";
  t = 0;
  x: number;
  y = START_Y;
  vx: number;
  vy: number;
  throttle = 0;
  fuel = FUEL_SECONDS;
  arms = 0;
  tilt = 0;
  wind = 0;
  pressed = false;
  burned = false;
  outcome?: Outcome;
  impact?: { x: number; y: number };
  trail: { x: number; y: number }[] = [];
  events: FlightEvent[] = [];
  private lockedVy = 0;
  private pending?: Outcome;
  private trailClock = 0;
  private settle = 0;

  constructor(flight: Flight | number) {
    this.flight = typeof flight === "number" ? flightFor(flight) : flight;
    this.x = this.flight.x0;
    this.vx = this.flight.vx0;
    this.vy = this.flight.vy0;
    this.wind = windAt(this.flight.wind, 0);
  }

  get bottom(): number {
    return this.y - PIN_OFFSET;
  }

  get offset(): number {
    return this.x - CATCH_X;
  }

  get inWindow(): boolean {
    return this.y >= ARMS_Y && this.y <= ARMS_Y + WINDOW;
  }

  get done(): boolean {
    return this.phase === "caught" || this.phase === "crashed";
  }

  /** Advance by dt with the button held (`pressed`) or not. */
  step(dt: number, pressed: boolean): void {
    const released = this.pressed && !pressed;
    this.pressed = pressed;
    if (this.phase === "ready") {
      if (released) {
        this.phase = "flying";
        this.emit({ type: "start" });
      }
      return;
    }
    if (this.done) {
      this.t += dt;
      if (this.phase === "caught" && this.settle < 1) {
        this.settle = Math.min(1, this.settle + dt / 0.9);
        this.y += (ARMS_Y - this.y) * Math.min(1, dt * 5);
        this.throttle += (0 - this.throttle) * Math.min(1, dt / 0.4);
      }
      return;
    }
    this.t += dt;
    this.wind = windAt(this.flight.wind, this.t);

    if (this.phase === "flying") {
      if (released && this.inWindow) {
        this.phase = "closing";
        this.lockedVy = this.vy;
        this.emit({ type: "closing" });
      } else {
        const want = pressed && this.fuel > 0 ? 1 : 0;
        if (want && !this.burned) {
          this.burned = true;
          this.emit({ type: "burn" });
        }
        this.throttle += (want - this.throttle) * Math.min(1, dt / SPOOL);
        const before = this.fuel;
        this.fuel = Math.max(0, this.fuel - this.throttle * dt);
        if (before > FUEL_SECONDS * 0.25 && this.fuel <= FUEL_SECONDS * 0.25) this.emit({ type: "fuel-low" });
        if (before > 0 && this.fuel === 0) this.emit({ type: "fuel-out" });
        const wasAbove = this.y > ARMS_Y + WINDOW;
        this.vy += (THRUST * this.throttle - G) * dt;
        this.y += this.vy * dt;
        if (wasAbove && this.inWindow) this.emit({ type: "window" });
      }
    }

    if (this.phase === "closing") {
      this.throttle += (G / THRUST - this.throttle) * Math.min(1, dt / SPOOL);
      this.vy = this.lockedVy;
      this.y += this.vy * dt;
      this.arms = Math.min(1, this.arms + dt / CLOSE_TIME);
      if (this.arms >= 1) this.judge();
    }

    if (this.phase === "falling") {
      this.throttle += (0 - this.throttle) * Math.min(1, dt / SPOOL);
      this.vy -= G * dt;
      this.y += this.vy * dt;
    }

    this.steer(dt);
    this.collide();

    this.trailClock += dt;
    if (this.trailClock >= 0.1) {
      this.trailClock = 0;
      this.trail.push({ x: this.x, y: this.y });
      if (this.trail.length > 240) this.trail.shift();
    }
  }

  /** Engines gimbal and grid fins steer toward the arms; the wind pushes back. */
  private steer(dt: number): void {
    const want = 0.25 * (CATCH_X - this.x) - 0.9 * this.vx;
    const authority = this.phase === "falling" ? 0 : 0.6 + 3.4 * this.throttle;
    const ctrl = clamp(want, -authority, authority);
    const ax = this.wind + ctrl - 0.04 * this.vx;
    this.vx += ax * dt;
    this.x += this.vx * dt;
    const lean = clamp(ctrl * 0.045 + this.wind * 0.02, -0.22, 0.22);
    this.tilt += (lean - this.tilt) * Math.min(1, dt * 3);
  }

  private judge(): void {
    const h = this.y - ARMS_Y;
    const offset = Math.abs(this.offset);
    const speed = Math.abs(this.vy);
    let reason: CrashReason | undefined;
    if (offset > MAX_CATCH_OFFSET) reason = "missed";
    else if (h < 0) reason = "slipped";
    else if (h > WINDOW) reason = "air";
    else if (speed > MAX_CATCH_SPEED) reason = "hot";
    if (reason) {
      this.phase = "falling";
      this.pending = { kind: "crashed", reason, speed, offset };
      return;
    }
    const score = Math.round(clamp(1000 - 110 * speed - 90 * offset, 100, 1000));
    const grade: Grade = speed <= 1 && offset <= 1 ? "perfect" : score >= 700 ? "clean" : "rough";
    const fuelLeft = this.fuel / FUEL_SECONDS;
    this.vx = 0;
    this.vy = 0;
    this.finish("caught", { kind: "caught", grade, speed, offset, score, fuelLeft });
  }

  private collide(): void {
    if (this.phase === "caught") return;
    const speed = Math.hypot(this.vx, this.vy);
    const offset = Math.abs(this.offset);
    const crash = (reason: CrashReason, y: number) => {
      this.impact = { x: this.x, y };
      this.finish("crashed", this.pending ?? { kind: "crashed", reason, speed, offset });
    };
    if (this.x + BOOSTER_R > TOWER_X - TOWER_HALF && this.x - BOOSTER_R < TOWER_X + TOWER_HALF && this.bottom < TOWER_H) {
      crash("tower", this.bottom + Math.min(BOOSTER_H, TOWER_H - this.bottom) / 2);
    } else if (this.bottom <= MOUNT_Y && Math.abs(this.offset) < MOUNT_HALF) {
      crash("mount", MOUNT_Y);
    } else if (this.bottom <= 0) {
      crash("ground", 0);
    }
  }

  private finish(phase: "caught" | "crashed", outcome: Outcome): void {
    this.phase = phase;
    this.outcome = outcome;
    this.emit({ type: "outcome", outcome });
  }

  private emit(e: FlightEvent): void {
    this.events.push(e);
  }

  drain(): FlightEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }
}

/**
 * A one-button pilot: suicide burn to just above the arms, hover-brake in the window, let go.
 * Used by the tests to prove every flight is catchable.
 */
export function autopilot(w: World): boolean {
  if (w.phase === "ready") return !w.pressed;
  if (w.phase !== "flying") return false;
  if (w.inWindow) {
    if (!w.pressed) return true;
    return w.vy < -0.6;
  }
  const net = THRUST - G;
  const down = Math.max(0, -w.vy);
  const stop = (down * down) / (2 * net * 0.8);
  const h = w.y - (ARMS_Y + 4);
  if (h <= stop + 2) return true;
  if (w.vy > 0) return false;
  const drift = Math.abs(w.offset) > 2.5 && w.y > 200 && w.fuel > 4.5;
  return drift && Math.floor(w.t * 4) % 2 === 0;
}
