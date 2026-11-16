import type { CrashReason, FlightEvent, Grade } from "./sim.ts";

// Launch-control lines, written by hand. Each event has a few takes; the flight seed picks one.
const LINES: Record<string, string[]> = {
  ready: ["Booster is on approach. Boostback burn complete.", "Boostback complete, booster is heading for the tower."],
  start: ["Tower is go for catch. Arms are open.", "Range is green. Chopsticks open and ready."],
  burn: ["Landing burn startup.", "Engines lit. Landing burn in progress.", "We have landing burn startup."],
  window: ["Booster is in the catch window.", "Pins are at arm height. Catch window."],
  "fuel-low": ["Propellant is getting low.", "Watch the propellant, getting thin."],
  "fuel-out": ["Engines out. Propellant depleted.", "That's all the propellant there is."],
  closing: ["Engines to hover. Arms closing.", "Arms closing on the booster."],
  perfect: ["Catch confirmed. That's about as gentle as it gets.", "The booster is in the tower. Textbook catch."],
  clean: ["Catch confirmed. The booster is in the tower.", "Booster caught. Nice work, everyone."],
  rough: ["We have a catch, but that one rattled the tower.", "Caught it. The tower is going to need an inspection."],
  hot: ["Came in too fast. The arms couldn't hold it.", "Too much speed at the arms. We've lost the booster."],
  slipped: ["The pins were below the arms. It slipped through.", "Arms closed above the pins and the booster slipped."],
  air: ["The arms closed under nothing. Booster was too high.", "Booster was above the window when the arms closed."],
  missed: ["Arms closed beside it. Too far off center.", "We were off center and the arms missed."],
  tower: ["Booster made contact with the tower.", "We've hit the tower. That's going to need repairs."],
  mount: ["Booster came down on the launch mount.", "Hard landing on the launch mount."],
  ground: ["Booster impacted the ground.", "We've lost the booster short of the tower."],
};

export type CalloutKey = keyof typeof LINES | Grade | CrashReason;

export function lineFor(key: string, seed: number): string {
  const takes = LINES[key] ?? [];
  return takes[Math.abs(seed) % takes.length] ?? "";
}

export function calloutFor(e: FlightEvent, seed: number): string {
  if (e.type === "outcome") {
    const key = e.outcome.kind === "caught" ? e.outcome.grade : e.outcome.reason;
    return lineFor(key, seed);
  }
  return lineFor(e.type, seed);
}

export function headline(e: FlightEvent & { type: "outcome" }): string {
  const o = e.outcome;
  if (o.kind === "caught") return { perfect: "Perfect catch", clean: "Clean catch", rough: "Caught it, barely" }[o.grade];
  return {
    hot: "Too hot",
    slipped: "Slipped through",
    air: "Arms closed on air",
    missed: "Missed the arms",
    tower: "Hit the tower",
    mount: "Hit the launch mount",
    ground: "Short of the tower",
  }[o.reason];
}

export function clock(t: number): string {
  const s = Math.max(0, Math.floor(t));
  return `T+${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
