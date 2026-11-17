// The still house, with no DOM. Time is counted in game minutes since the start date.

export const RULES = {
  start: { corn: 4, sugar: 4, water: 20 },
  batch: { corn: 1, sugar: 1, water: 10 },
  mashGallons: 10,
  cookHours: 2,
  fermentHours: 36,
  stillHours: 6,
  jarsPerRun: 6,
  haulHours: 1,
  haulGallons: 10,
  waterCap: 40,
  logSize: 40,
} as const;

/** Real milliseconds per game hour at normal speed. */
export const MS_PER_GAME_HOUR = 3000;
export const START_DATE = Date.UTC(1928, 9, 1, 6, 0);

export type Barrel =
  | { status: "empty" }
  | { status: "cooking"; from: number; until: number }
  | { status: "working"; from: number; until: number }
  | { status: "ready" };

export type Still =
  | { status: "cold" }
  | { status: "loaded" }
  | { status: "running"; from: number; until: number; jars: number };

export type Haul = { from: number; until: number } | null;

export interface LogEntry {
  at: number;
  text: string;
}

export interface State {
  version: 1;
  clock: number;
  corn: number;
  sugar: number;
  water: number;
  jars: number;
  barrels: [Barrel, Barrel];
  still: Still;
  haul: Haul;
  log: LogEntry[];
}

export type Result = { ok: true } | { ok: false; reason: string };

const H = 60;

export function newGame(): State {
  const s: State = {
    version: 1,
    clock: 0,
    corn: RULES.start.corn,
    sugar: RULES.start.sugar,
    water: RULES.start.water,
    jars: 0,
    barrels: [{ status: "empty" }, { status: "empty" }],
    still: { status: "cold" },
    haul: null,
    log: [],
  };
  note(s, "You've got corn, sugar and a creek out back. Mix a batch of mash to get started.");
  return s;
}

function note(s: State, text: string, at = s.clock): void {
  s.log.unshift({ at, text });
  if (s.log.length > RULES.logSize) s.log.length = RULES.logSize;
}

const fail = (reason: string): Result => ({ ok: false, reason });
const OK: Result = { ok: true };

export const barrelName = (i: number) => `Barrel ${i + 1}`;

export function canMix(s: State, i: number): Result {
  const b = s.barrels[i];
  if (!b) return fail("There's no such barrel.");
  if (b.status !== "empty") return fail(`${barrelName(i)} isn't empty.`);
  if (s.corn < RULES.batch.corn) return fail("You're out of corn.");
  if (s.sugar < RULES.batch.sugar) return fail("You're out of sugar.");
  if (s.water < RULES.batch.water) return fail(`You need ${RULES.batch.water} gallons of water. Haul some from the creek.`);
  return OK;
}

export function mix(s: State, i: number): Result {
  const r = canMix(s, i);
  if (!r.ok) return r;
  s.corn -= RULES.batch.corn;
  s.sugar -= RULES.batch.sugar;
  s.water -= RULES.batch.water;
  s.barrels[i] = { status: "cooking", from: s.clock, until: s.clock + RULES.cookHours * H };
  note(s, `Cooking corn, sugar and water down in ${barrelName(i)}.`);
  return OK;
}

export function canPour(s: State, i: number): Result {
  const b = s.barrels[i];
  if (!b || b.status !== "ready") return fail(`${barrelName(i)} isn't ready yet.`);
  if (s.still.status !== "cold") return fail("The still is already full.");
  return OK;
}

export function pour(s: State, i: number): Result {
  const r = canPour(s, i);
  if (!r.ok) return r;
  s.barrels[i] = { status: "empty" };
  s.still = { status: "loaded" };
  note(s, `Poured ${RULES.mashGallons} gallons of mash from ${barrelName(i)} into the still.`);
  return OK;
}

export function canLight(s: State): Result {
  if (s.still.status === "running") return fail("The still is already running.");
  if (s.still.status !== "loaded") return fail("Pour some ready mash into the still first.");
  return OK;
}

export function light(s: State): Result {
  const r = canLight(s);
  if (!r.ok) return r;
  s.still = { status: "running", from: s.clock, until: s.clock + RULES.stillHours * H, jars: 0 };
  note(s, "Fire's lit under the still. Shine should start dripping soon.");
  return OK;
}

export function canHaul(s: State): Result {
  if (s.haul) return fail("You're already down at the creek.");
  if (s.water >= RULES.waterCap) return fail("The water barrel is full.");
  return OK;
}

export function haul(s: State): Result {
  const r = canHaul(s);
  if (!r.ok) return r;
  s.haul = { from: s.clock, until: s.clock + RULES.haulHours * H };
  note(s, "Headed down to the creek with two buckets.");
  return OK;
}

/** Time of the next thing that changes on its own, or Infinity. */
function nextEvent(s: State): number {
  let t = Infinity;
  for (const b of s.barrels) if (b.status === "cooking" || b.status === "working") t = Math.min(t, b.until);
  if (s.haul) t = Math.min(t, s.haul.until);
  if (s.still.status === "running") t = Math.min(t, nextJarAt(s.still));
  return t;
}

function nextJarAt(still: Extract<Still, { status: "running" }>): number {
  const per = (still.until - still.from) / RULES.jarsPerRun;
  return still.from + per * (still.jars + 1);
}

function settle(s: State): void {
  s.barrels.forEach((b, i) => {
    if (b.status === "cooking" && s.clock >= b.until) {
      const until = b.until + RULES.fermentHours * H;
      s.barrels[i] = { status: "working", from: b.until, until };
      note(s, `${barrelName(i)} has cooled and the yeast is working. Give it a day and a half.`, b.until);
    } else if (b.status === "working" && s.clock >= b.until) {
      s.barrels[i] = { status: "ready" };
      note(s, `${barrelName(i)} has gone quiet. The mash is ready for the still.`, b.until);
    }
  });
  if (s.haul && s.clock >= s.haul.until) {
    const at = s.haul.until;
    const gained = Math.min(RULES.haulGallons, RULES.waterCap - s.water);
    s.water += gained;
    s.haul = null;
    note(s, `Back from the creek with ${gained} gallons of water.`, at);
  }
  const still = s.still;
  if (still.status === "running") {
    while (still.jars < RULES.jarsPerRun && s.clock >= nextJarAt(still)) {
      const at = nextJarAt(still);
      still.jars += 1;
      s.jars += 1;
      if (still.jars === 1) note(s, "First jar's full. That's moonshine.", at);
    }
    if (still.jars >= RULES.jarsPerRun) {
      s.still = { status: "cold" };
      note(s, `The run is done: ${RULES.jarsPerRun} jars of white lightning on the shelf.`, still.until);
    }
  }
}

/** Advance the clock, settling every event at the moment it happens. */
export function advance(s: State, minutes: number): void {
  const target = s.clock + Math.max(0, minutes);
  for (;;) {
    const t = nextEvent(s);
    if (t > target) break;
    s.clock = t;
    settle(s);
  }
  s.clock = target;
}

export function progress(from: number, until: number, clock: number): number {
  return Math.min(1, Math.max(0, (clock - from) / (until - from)));
}

/** Mash gallons by state, for the ledger. */
export function mashTally(s: State): { working: number; ready: number; inStill: number } {
  let working = 0;
  let ready = 0;
  for (const b of s.barrels) {
    if (b.status === "cooking" || b.status === "working") working += RULES.mashGallons;
    if (b.status === "ready") ready += RULES.mashGallons;
  }
  const inStill =
    s.still.status === "loaded"
      ? RULES.mashGallons
      : s.still.status === "running"
        ? Math.round(RULES.mashGallons * (1 - progress(s.still.from, s.still.until, s.clock)))
        : 0;
  return { working, ready, inStill };
}

/** Out of grain or sugar with nothing left in the barrels or the still. */
export function isDone(s: State): boolean {
  const idle = s.barrels.every((b) => b.status === "empty") && s.still.status === "cold";
  return idle && (s.corn < RULES.batch.corn || s.sugar < RULES.batch.sugar);
}

/** One line telling the player what they can do next. */
export function hint(s: State): string {
  if (isDone(s)) return "Out of corn and sugar. The jars are on the shelf.";
  const ready = s.barrels.findIndex((b) => b.status === "ready");
  if (s.still.status === "loaded") return "Light the fire under the still.";
  if (ready >= 0 && s.still.status === "cold") return `Pour ${barrelName(ready)} into the still.`;
  const empty = s.barrels.findIndex((b) => b.status === "empty");
  if (empty >= 0 && s.corn >= 1 && s.sugar >= 1) {
    if (s.water >= RULES.batch.water) return `Mix a batch of mash in ${barrelName(empty)}.`;
    return s.haul ? "Wait for the water from the creek." : "Haul water from the creek for the next batch.";
  }
  if (s.still.status === "running") return "The still is running. Watch the jars fill.";
  return "The mash is working. Speed up the clock or tend to something else.";
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function gameDate(clock: number): Date {
  return new Date(START_DATE + clock * 60_000);
}

export function formatDay(clock: number): string {
  const d = gameDate(clock);
  return `${DAYS[d.getUTCDay()]}, ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

export function formatTime(clock: number): string {
  const d = gameDate(clock);
  const h = d.getUTCHours();
  const m = d.getUTCMinutes();
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

/** Hour of day with fraction, 0–24. */
export function hourOfDay(clock: number): number {
  return (((clock / 60 + 6) % 24) + 24) % 24;
}

export function formatDuration(minutes: number): string {
  const m = Math.max(0, Math.ceil(minutes));
  if (m < 60) return `${m} min`;
  const h = Math.ceil(m / 60);
  return h === 1 ? "1 hr" : `${h} hrs`;
}

const KEY = "dry-county:v1";

export function serialize(s: State): string {
  return JSON.stringify(s);
}

export function deserialize(raw: string | null): State | null {
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as State;
    if (s?.version !== 1 || !Array.isArray(s.barrels) || s.barrels.length !== 2 || typeof s.clock !== "number") return null;
    return s;
  } catch {
    return null;
  }
}

export const STORAGE_KEY = KEY;
