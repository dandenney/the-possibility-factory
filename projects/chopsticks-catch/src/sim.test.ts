import { describe, expect, it } from "vitest";
import { ARMS_Y, FUEL_SECONDS, World, autopilot, flightFor, windAt } from "./sim.ts";

const DT = 1 / 120;

function fly(w: World, pilot: (w: World) => boolean, seconds = 40) {
  for (let i = 0; i < seconds / DT && !w.done; i++) w.step(DT, pilot(w));
  return w;
}

function launch(seed: number) {
  const w = new World(seed);
  w.step(DT, true);
  w.step(DT, false);
  return w;
}

describe("flights", () => {
  it("are deterministic per seed", () => {
    expect(flightFor(42)).toEqual(flightFor(42));
    expect(flightFor(42)).not.toEqual(flightFor(43));
    const a = fly(new World(7), autopilot);
    const b = fly(new World(7), autopilot);
    expect(a.outcome).toEqual(b.outcome);
    expect(a.t).toBe(b.t);
  });

  it("wait for a tap before the descent starts", () => {
    const w = new World(1);
    w.step(DT, true);
    expect(w.phase).toBe("ready");
    w.step(DT, false);
    expect(w.phase).toBe("flying");
    expect(w.fuel).toBe(FUEL_SECONDS);
  });

  it("keep the wind within reach of the engines", () => {
    for (let s = 1; s < 200; s++) {
      const f = flightFor(s);
      for (let t = 0; t < 20; t += 0.5) expect(Math.abs(windAt(f.wind, t))).toBeLessThan(1.7);
    }
  });

  it("are almost all catchable with one button", () => {
    let caught = 0;
    for (let s = 1; s <= 300; s++) if (fly(new World(s), autopilot).outcome?.kind === "caught") caught++;
    expect(caught / 300).toBeGreaterThan(0.97);
  });
});

describe("crashing", () => {
  it("never burning ends on the ground or the mount", () => {
    for (const s of [1, 2, 3, 50, 99]) {
      const w = fly(launch(s), () => false);
      expect(w.outcome?.kind).toBe("crashed");
      expect(["mount", "ground", "tower"]).toContain(w.outcome?.kind === "crashed" && w.outcome.reason);
      expect(w.impact).toBeDefined();
    }
  });

  it("burning forever runs out of propellant and falls", () => {
    const w = fly(launch(5), () => true);
    expect(w.events.some((e) => e.type === "fuel-out") || w.fuel === 0).toBe(true);
    expect(w.outcome?.kind).toBe("crashed");
  });

  it("letting go fast in the window is too hot", () => {
    const w = launch(9);
    w.y = ARMS_Y + 5;
    w.vy = -9;
    w.x = -16;
    w.vx = 0;
    w.step(DT, true);
    w.step(DT, false);
    expect(w.phase).toBe("closing");
    fly(w, () => false);
    expect(w.outcome).toMatchObject({ kind: "crashed", reason: "hot" });
  });

  it("letting go low and fast slips through the arms", () => {
    const w = launch(9);
    Object.assign(w, { y: ARMS_Y + 2, vy: -9, x: -16, vx: 0 });
    w.step(DT, true);
    w.step(DT, false);
    fly(w, () => false);
    expect(w.outcome).toMatchObject({ kind: "crashed", reason: "slipped" });
  });

  it("letting go above the window only cuts the engines", () => {
    const w = launch(9);
    w.step(DT, true);
    w.step(DT, false);
    expect(w.phase).toBe("flying");
    expect(w.arms).toBe(0);
  });
});

describe("catching", () => {
  it("grades a still, centred hover as perfect", () => {
    const w = launch(3);
    Object.assign(w, { y: ARMS_Y + 3, vy: -0.4, x: -16, vx: 0 });
    w.step(DT, true);
    w.step(DT, false);
    fly(w, () => false);
    expect(w.outcome).toMatchObject({ kind: "caught", grade: "perfect" });
    if (w.outcome?.kind === "caught") expect(w.outcome.score).toBeGreaterThan(900);
  });

  it("treats a fast but survivable catch as rough", () => {
    const w = launch(3);
    Object.assign(w, { y: ARMS_Y + 7.9, vy: -4.2, x: -16, vx: 0 });
    w.step(DT, true);
    w.step(DT, false);
    fly(w, () => false);
    expect(w.outcome).toMatchObject({ kind: "caught", grade: "rough" });
  });

  it("emits launch-control events in order", () => {
    const w = new World(11);
    const seen: string[] = [];
    for (let i = 0; i < 40 / DT && !w.done; i++) {
      w.step(DT, autopilot(w));
      for (const e of w.drain()) seen.push(e.type);
    }
    expect(seen[0]).toBe("start");
    expect(seen).toContain("burn");
    expect(seen.indexOf("closing")).toBeGreaterThan(seen.indexOf("burn"));
    expect(seen.at(-1)).toBe("outcome");
  });
});
