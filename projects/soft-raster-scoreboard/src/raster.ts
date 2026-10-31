import { transform, type Mat4 } from "./math.ts";

/** RGBA8 texture packed little-endian (0xAABBGGRR), matching ImageData's byte order. */
export interface Texture {
  width: number;
  height: number;
  data: Uint32Array;
}

export interface Mesh {
  /** xyz per vertex. */
  positions: Float32Array;
  /** uv per vertex, 0..1. Required when drawing with a texture. */
  uvs?: Float32Array;
  /** rgb per vertex, 0..1 (lighting baked in or computed per frame). */
  colors?: Float32Array;
  indices: Uint32Array;
}

export interface DrawOptions {
  texture?: Texture;
  /** Pull the mesh toward the camera in depth so decals win against the surface below. */
  depthBias?: number;
  /** Skip triangles facing away from the camera. */
  cull?: boolean;
  /** Darken what's already there by the vertex color instead of overwriting it (no depth write). */
  multiply?: boolean;
}

export interface FrameStats {
  triangles: number;
  pixels: number;
}

export function rgb(r: number, g: number, b: number, a = 255): number {
  return (((a & 255) << 24) | ((b & 255) << 16) | ((g & 255) << 8) | (r & 255)) >>> 0;
}

export function unpack(c: number): [number, number, number] {
  return [c & 255, (c >>> 8) & 255, (c >>> 16) & 255];
}

export function hexColor(hex: string, fallback = "777777"): [number, number, number] {
  const clean = /^[0-9a-f]{6}$/i.test(hex) ? hex : fallback;
  return [parseInt(clean.slice(0, 2), 16), parseInt(clean.slice(2, 4), 16), parseInt(clean.slice(4, 6), 16)];
}

/** A clip-space vertex plus the attributes we interpolate: u, v, r, g, b. */
type ClipVertex = [x: number, y: number, z: number, w: number, u: number, v: number, r: number, g: number, b: number];

const NEAR_W = 0.05;

/** Sutherland–Hodgman against the near plane (w > NEAR_W). Returns 0, 3 or 4 vertices. */
export function clipNear(poly: ClipVertex[]): ClipVertex[] {
  const out: ClipVertex[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    const aIn = a[3] > NEAR_W;
    const bIn = b[3] > NEAR_W;
    if (aIn) out.push(a);
    if (aIn !== bIn) {
      const t = (NEAR_W - a[3]) / (b[3] - a[3]);
      out.push(a.map((v, k) => v + (b[k]! - v) * t) as ClipVertex);
    }
  }
  return out;
}

export class Framebuffer {
  readonly color: Uint32Array;
  readonly depth: Float32Array;
  readonly stats: FrameStats = { triangles: 0, pixels: 0 };

  constructor(
    readonly width: number,
    readonly height: number,
    buffer?: ArrayBuffer,
  ) {
    this.color = buffer ? new Uint32Array(buffer) : new Uint32Array(width * height);
    this.depth = new Float32Array(width * height);
  }

  clear(color: number) {
    this.color.fill(color);
    this.depth.fill(Infinity);
    this.stats.triangles = 0;
    this.stats.pixels = 0;
  }

  /** Vertical gradient background, written without touching depth. */
  gradient(top: [number, number, number], bottom: [number, number, number]) {
    const { width, height, color } = this;
    for (let y = 0; y < height; y++) {
      const t = y / (height - 1);
      const c = rgb(top[0] + (bottom[0] - top[0]) * t, top[1] + (bottom[1] - top[1]) * t, top[2] + (bottom[2] - top[2]) * t);
      color.fill(c, y * width, (y + 1) * width);
    }
  }

  drawMesh(mesh: Mesh, mvp: Mat4, opts: DrawOptions = {}) {
    const { positions, uvs, colors, indices } = mesh;
    const count = positions.length / 3;
    const clip: ClipVertex[] = new Array(count);
    for (let i = 0; i < count; i++) {
      const [x, y, z, w] = transform(mvp, positions[i * 3]!, positions[i * 3 + 1]!, positions[i * 3 + 2]!);
      clip[i] = [
        x, y, z, w,
        uvs ? uvs[i * 2]! : 0, uvs ? uvs[i * 2 + 1]! : 0,
        colors ? colors[i * 3]! : 1, colors ? colors[i * 3 + 1]! : 1, colors ? colors[i * 3 + 2]! : 1,
      ];
    }
    for (let i = 0; i < indices.length; i += 3) {
      const tri = [clip[indices[i]!]!, clip[indices[i + 1]!]!, clip[indices[i + 2]!]!];
      const poly = tri.every((v) => v[3] > NEAR_W) ? tri : clipNear(tri);
      for (let k = 1; k + 1 < poly.length; k++) this.rasterize(poly[0]!, poly[k]!, poly[k + 1]!, opts);
    }
  }

  private rasterize(a: ClipVertex, b: ClipVertex, c: ClipVertex, opts: DrawOptions) {
    const { width, height, color, depth } = this;
    const bias = opts.depthBias ?? 0;
    // Perspective divide + viewport. Attributes are divided by w for perspective-correct interpolation.
    const sx = (v: ClipVertex) => (v[0] / v[3] * 0.5 + 0.5) * width;
    const sy = (v: ClipVertex) => (1 - (v[1] / v[3] * 0.5 + 0.5)) * height;
    const ax = sx(a), ay = sy(a), bx = sx(b), by = sy(b), cx = sx(c), cy = sy(c);
    const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    if (area === 0 || !Number.isFinite(area)) return;
    if (opts.cull && area > 0) return;

    const minX = Math.max(0, Math.floor(Math.min(ax, bx, cx)));
    const maxX = Math.min(width - 1, Math.ceil(Math.max(ax, bx, cx)));
    const minY = Math.max(0, Math.floor(Math.min(ay, by, cy)));
    const maxY = Math.min(height - 1, Math.ceil(Math.max(ay, by, cy)));
    if (minX > maxX || minY > maxY) return;
    this.stats.triangles++;

    const iwA = 1 / a[3], iwB = 1 / b[3], iwC = 1 / c[3];
    const zA = a[2] * iwA - bias, zB = b[2] * iwB - bias, zC = c[2] * iwC - bias;
    const tex = opts.texture;
    // Edge functions below come out with the opposite sign to `area`.
    const invArea = -1 / area;

    // Edge function setup: w0 is the weight of A (opposite edge BC), etc.
    const e0x = cy - by, e0y = bx - cx; // edge B->C
    const e1x = ay - cy, e1y = cx - ax; // edge C->A
    const e2x = by - ay, e2y = ax - bx; // edge A->B

    for (let py = minY; py <= maxY; py++) {
      const fy = py + 0.5;
      const fx = minX + 0.5;
      let w0 = (fx - bx) * e0x + (fy - by) * e0y;
      let w1 = (fx - cx) * e1x + (fy - cy) * e1y;
      let w2 = (fx - ax) * e2x + (fy - ay) * e2y;
      let row = py * width + minX;
      for (let px = minX; px <= maxX; px++, row++, w0 += e0x, w1 += e1x, w2 += e2x) {
        const l0 = w0 * invArea, l1 = w1 * invArea, l2 = w2 * invArea;
        if (l0 < 0 || l1 < 0 || l2 < 0) continue;
        const z = l0 * zA + l1 * zB + l2 * zC;
        if (z >= depth[row]! || z < -1) continue;
        const p0 = l0 * iwA, p1 = l1 * iwB, p2 = l2 * iwC;
        const pw = 1 / (p0 + p1 + p2);
        const r = (p0 * a[6] + p1 * b[6] + p2 * c[6]) * pw;
        const g = (p0 * a[7] + p1 * b[7] + p2 * c[7]) * pw;
        const bl = (p0 * a[8] + p1 * b[8] + p2 * c[8]) * pw;
        let tr = 255, tg = 255, tb = 255;
        if (tex) {
          const u = (p0 * a[4] + p1 * b[4] + p2 * c[4]) * pw;
          const v = (p0 * a[5] + p1 * b[5] + p2 * c[5]) * pw;
          const tx = Math.min(tex.width - 1, Math.max(0, (u * tex.width) | 0));
          const ty = Math.min(tex.height - 1, Math.max(0, (v * tex.height) | 0));
          const t = tex.data[ty * tex.width + tx]!;
          tr = t & 255; tg = (t >>> 8) & 255; tb = (t >>> 16) & 255;
        }
        if (opts.multiply) {
          const d = color[row]!;
          color[row] = (0xff000000 | (((((d >>> 16) & 255) * bl) | 0) << 16) | (((((d >>> 8) & 255) * g) | 0) << 8) | (((d & 255) * r) | 0)) >>> 0;
          continue;
        }
        depth[row] = z;
        color[row] = (0xff000000 | (Math.min(255, tb * bl) << 16) | (Math.min(255, tg * g) << 8) | Math.min(255, tr * r)) >>> 0;
        this.stats.pixels++;
      }
    }
  }

  /** Depth-tested 3D line, drawn `thickness` pixels wide. */
  drawLine(mvp: Mat4, from: [number, number, number], to: [number, number, number], rgba: number, thickness = 1) {
    const [a, b] = [from, to].map((p) => {
      const [x, y, z, w] = transform(mvp, p[0], p[1], p[2]);
      return [x, y, z, w, 0, 0, 1, 1, 1] as ClipVertex;
    }) as [ClipVertex, ClipVertex];
    if (a[3] <= NEAR_W && b[3] <= NEAR_W) return;
    const clipEnd = (p: ClipVertex, q: ClipVertex) =>
      p[3] > NEAR_W ? p : (p.map((v, k) => v + (q[k]! - v) * ((NEAR_W - p[3]) / (q[3] - p[3]))) as ClipVertex);
    const p = clipEnd(a, b), q = clipEnd(b, a);
    const { width, height, color, depth } = this;
    const x0 = (p[0] / p[3] * 0.5 + 0.5) * width, y0 = (1 - (p[1] / p[3] * 0.5 + 0.5)) * height, z0 = p[2] / p[3];
    const x1 = (q[0] / q[3] * 0.5 + 0.5) * width, y1 = (1 - (q[1] / q[3] * 0.5 + 0.5)) * height, z1 = q[2] / q[3];
    const steps = Math.min(4096, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))) + 1);
    const half = (thickness - 1) / 2;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const cx = x0 + (x1 - x0) * t, cy = y0 + (y1 - y0) * t, z = z0 + (z1 - z0) * t - 0.0005;
      for (let oy = -half; oy <= half; oy++) {
        for (let ox = -half; ox <= half; ox++) {
          const px = Math.round(cx + ox), py = Math.round(cy + oy);
          if (px < 0 || py < 0 || px >= width || py >= height) continue;
          const idx = py * width + px;
          if (z >= depth[idx]!) continue;
          color[idx] = rgba;
        }
      }
    }
  }
}
