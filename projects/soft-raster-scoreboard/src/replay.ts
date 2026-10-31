import { FIELD_WIDTH, type Play } from "./espn.ts";

export interface Segment {
  from: [x: number, z: number, y: number];
  to: [x: number, z: number, y: number];
  /** Extra height at the middle of the segment (parabolic arc). */
  peak: number;
}

export const BALL_REST = 0.35;
const MID = FIELD_WIDTH / 2;
const HASH_LO = 20;
const HASH_HI = FIELD_WIDTH - 20;

/** Direction the team with the ball is attacking: home drives toward x = 100. */
export function attackDir(play: Play): 1 | -1 {
  return play.offense === "away" ? -1 : 1;
}

/** Where the ball is snapped from: the previous spot, pulled inside the hashes. */
export function snapLane(prevLane: number): number {
  return Math.min(HASH_HI, Math.max(HASH_LO, prevLane));
}

function kickDistance(text: string): number | undefined {
  const m = text.match(/\b(?:kickoff|punt)s?\s+(\d+)\s+yards?/i);
  return m ? Number(m[1]) : undefined;
}

const clampX = (x: number) => Math.min(110, Math.max(-10, x));

/** Approximate the ball's path for a play from what ESPN tells us: start, end, type, and the text. */
export function flightFor(play: Play, prevLane: number): Segment[] {
  const dir = attackDir(play);
  const z0 = snapLane(prevLane);
  const { startX, endX, lane } = play;
  const r = BALL_REST;
  const span = Math.abs(endX - startX);
  switch (play.kind) {
    case "kick":
    case "punt": {
      const dist = kickDistance(play.text);
      const landX = clampX(dist != null ? startX + dir * dist : endX);
      const peak = play.kind === "kick" ? 18 : 16;
      const kick: Segment = { from: [startX, play.kind === "kick" ? MID : z0, r], to: [landX, lane, r], peak };
      if (Math.abs(landX - endX) < 0.5 || /touchback|fair catch|out of bounds/i.test(play.text)) return [kick];
      return [kick, { from: [landX, lane, r], to: [endX, snapLane(lane), r], peak: 0.4 }];
    }
    case "fg": {
      const postX = dir > 0 ? 110 : -10;
      const good = /good/i.test(play.type);
      return [{ from: [startX - dir * 7, z0, r], to: [postX, good ? MID : MID + 6, good ? 5 : 2], peak: 9 }];
    }
    case "pass": {
      if (/sack/i.test(play.type)) return [{ from: [startX, z0, r + 1], to: [endX, z0, r + 1], peak: 0.2 }];
      const dropX = startX - dir * 5;
      const drop: Segment = { from: [startX, z0, r], to: [dropX, z0, 1.8], peak: 0.3 };
      if (/incompletion/i.test(play.type)) {
        const targetX = clampX(startX + dir * 12);
        return [drop, { from: [dropX, z0, 1.8], to: [targetX, lane, r], peak: 5 }];
      }
      const catchX = endX - dir * Math.min(span * 0.3, 6);
      const throwPeak = Math.min(10, 1.5 + Math.abs(catchX - dropX) * 0.16);
      const segs: Segment[] = [drop, { from: [dropX, z0, 1.8], to: [catchX, lane, 1.4], peak: throwPeak }];
      if (Math.abs(catchX - endX) > 0.5) segs.push({ from: [catchX, lane, 1.4], to: [endX, lane, 1], peak: 0.2 });
      return segs;
    }
    case "rush":
      return [{ from: [startX, z0, r], to: [endX, lane, 1], peak: 0.5 }];
    default:
      return [{ from: [endX, z0, r], to: [endX, z0, r], peak: 0 }];
  }
}

function segLength(s: Segment): number {
  return Math.hypot(s.to[0] - s.from[0], s.to[1] - s.from[1]) + s.peak;
}

/** Ball position at progress t (0..1) through the flight, as world [x, y, z]. */
export function sampleFlight(segs: Segment[], t: number): [number, number, number] {
  const lengths = segs.map(segLength);
  const total = lengths.reduce((a, b) => a + b, 0);
  if (total === 0 || segs.length === 0) {
    const s = segs[0];
    return s ? [s.to[0], s.to[2], s.to[1]] : [50, BALL_REST, MID];
  }
  let d = Math.min(1, Math.max(0, t)) * total;
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i]!;
    const len = lengths[i]!;
    if (d <= len || i === segs.length - 1) {
      const u = len === 0 ? 1 : Math.min(1, d / len);
      const x = s.from[0] + (s.to[0] - s.from[0]) * u;
      const z = s.from[1] + (s.to[1] - s.from[1]) * u;
      const y = s.from[2] + (s.to[2] - s.from[2]) * u + 4 * s.peak * u * (1 - u);
      return [x, y, z];
    }
    d -= len;
  }
  return [50, BALL_REST, MID];
}

/** Seconds of animation per play at 1× speed. */
export function playDuration(play: Play): number {
  switch (play.kind) {
    case "kick":
    case "punt":
      return 2.4;
    case "fg":
      return 1.8;
    case "pass":
      return 1.8;
    case "rush":
      return 1.2;
    default:
      return 0.5;
  }
}
