import { RADIUS_M } from "./geo.ts";

/** A camera framing: the ground point it looks at, how far back, which way it faces, how steeply. */
export interface View {
  x: number;
  z: number;
  /** metres from the camera to the target */
  dist: number;
  /** compass degrees the camera faces: 0 = north, 90 = east */
  heading: number;
  /** degrees above the horizon the camera looks down from */
  pitch: number;
}

export const LIMITS = { minDist: 40, maxDist: 2600, minPitch: 8, maxPitch: 89 } as const;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const wrap360 = (deg: number) => ((deg % 360) + 360) % 360;
const DEG = Math.PI / 180;

export function normalizeView(v: View): View {
  const r = Math.hypot(v.x, v.z);
  const k = r > RADIUS_M * 1.1 ? (RADIUS_M * 1.1) / r : 1;
  return {
    x: v.x * k,
    z: v.z * k,
    dist: clamp(v.dist, LIMITS.minDist, LIMITS.maxDist),
    heading: wrap360(v.heading),
    pitch: clamp(v.pitch, LIMITS.minPitch, LIMITS.maxPitch),
  };
}

type Vec3 = { x: number; y: number; z: number };

/** Camera position for a view whose target sits at height `y`. */
export function cameraFor(v: View, y: number): Vec3 {
  const h = v.heading * DEG, p = v.pitch * DEG;
  const back = v.dist * Math.cos(p);
  return { x: v.x - Math.sin(h) * back, y: y + v.dist * Math.sin(p), z: v.z + Math.cos(h) * back };
}

/** The view a camera at `pos` looking at `target` shows. */
export function viewFrom(pos: Vec3, target: Vec3): View {
  const dx = target.x - pos.x, dy = pos.y - target.y, dz = target.z - pos.z;
  const flat = Math.hypot(dx, dz);
  return {
    x: target.x,
    z: target.z,
    dist: Math.hypot(flat, dy),
    heading: wrap360(Math.atan2(dx, -dz) / DEG),
    pitch: Math.atan2(dy, flat) / DEG,
  };
}

export type HashRoute = { kind: "landmark"; id: string } | { kind: "view"; view: View } | null;

/** `#ryman` frames a landmark; `#@x,z,dist,heading,pitch` is any shared view. */
export function parseHash(hash: string, landmarkIds: readonly string[]): HashRoute {
  const h = decodeURIComponent(hash.replace(/^#/, "")).trim();
  if (!h) return null;
  if (h.startsWith("@")) {
    const n = h.slice(1).split(",").map(Number);
    if (n.length !== 5 || n.some((v) => !Number.isFinite(v))) return null;
    const [x, z, dist, heading, pitch] = n as [number, number, number, number, number];
    return { kind: "view", view: normalizeView({ x, z, dist, heading, pitch }) };
  }
  return landmarkIds.includes(h) ? { kind: "landmark", id: h } : null;
}

export function formatHash(v: View): string {
  const n = normalizeView(v);
  return `#@${[n.x, n.z, n.dist, n.heading, n.pitch].map((x) => Math.round(x)).join(",")}`;
}
