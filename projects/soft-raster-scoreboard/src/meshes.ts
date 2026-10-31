import { normalize, type Vec3 } from "./math.ts";
import type { Mesh } from "./raster.ts";

export const LIGHT: Vec3 = normalize([-0.4, 0.85, 0.35]);

export function shade(n: Vec3, base: Vec3, ambient = 0.45): Vec3 {
  const d = Math.max(0, n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]);
  const k = ambient + (1 - ambient) * d;
  return [base[0] * k, base[1] * k, base[2] * k];
}

/** A flat grid on y = 0 spanning [x0, x1] × [z0, z1] with uvs mapped across it. */
export function plane(x0: number, x1: number, z0: number, z1: number, nx: number, nz: number, y = 0): Mesh {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let j = 0; j <= nz; j++) {
    for (let i = 0; i <= nx; i++) {
      positions.push(x0 + ((x1 - x0) * i) / nx, y, z0 + ((z1 - z0) * j) / nz);
      uvs.push(i / nx, j / nz);
    }
  }
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i;
      indices.push(a, a + 1, a + nx + 2, a, a + nx + 2, a + nx + 1);
    }
  }
  return { positions: new Float32Array(positions), uvs: new Float32Array(uvs), indices: new Uint32Array(indices) };
}

/** Axis-aligned box with lighting baked per face. */
export function box(min: Vec3, max: Vec3, color: Vec3): Mesh {
  const [x0, y0, z0] = min;
  const [x1, y1, z1] = max;
  const faces: [Vec3, Vec3[]][] = [
    [[0, 1, 0], [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]]],
    [[0, -1, 0], [[x0, y0, z0], [x0, y0, z1], [x1, y0, z1], [x1, y0, z0]]],
    [[1, 0, 0], [[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]]],
    [[-1, 0, 0], [[x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1]]],
    [[0, 0, 1], [[x0, y0, z1], [x0, y1, z1], [x1, y1, z1], [x1, y0, z1]]],
    [[0, 0, -1], [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]]],
  ];
  return merge(
    faces.map(([n, quad]) => {
      const c = shade(n, color);
      return {
        positions: new Float32Array(quad.flat()),
        colors: new Float32Array([...c, ...c, ...c, ...c]),
        indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
      };
    }),
  );
}

/** A sloped quad (e.g. a grandstand) with uvs, from edge a0→a1 up to edge b0→b1. */
export function quad(a0: Vec3, a1: Vec3, b1: Vec3, b0: Vec3, tint: Vec3 = [1, 1, 1]): Mesh {
  return {
    positions: new Float32Array([...a0, ...a1, ...b1, ...b0]),
    uvs: new Float32Array([0, 1, 1, 1, 1, 0, 0, 0]),
    colors: new Float32Array([...tint, ...tint, ...tint, ...tint]),
    indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
  };
}

export function merge(meshes: Mesh[]): Mesh {
  const positions: number[] = [];
  const colors: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  let offset = 0;
  for (const m of meshes) {
    const n = m.positions.length / 3;
    positions.push(...m.positions);
    for (let i = 0; i < n; i++) {
      colors.push(...(m.colors ? [m.colors[i * 3]!, m.colors[i * 3 + 1]!, m.colors[i * 3 + 2]!] : [1, 1, 1]));
      uvs.push(...(m.uvs ? [m.uvs[i * 2]!, m.uvs[i * 2 + 1]!] : [0, 0]));
    }
    for (const idx of m.indices) indices.push(idx + offset);
    offset += n;
  }
  return {
    positions: new Float32Array(positions),
    colors: new Float32Array(colors),
    uvs: new Float32Array(uvs),
    indices: new Uint32Array(indices),
  };
}

export interface Ellipsoid extends Mesh {
  normals: Float32Array;
  colors: Float32Array;
}

/** Prolate spheroid along x: a football. */
export function football(length: number, radius: number, rings = 8, segments = 10): Ellipsoid {
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= rings; i++) {
    const t = (i / rings) * Math.PI;
    const x = Math.cos(t) * (length / 2);
    const r = Math.sin(t) * radius;
    for (let j = 0; j <= segments; j++) {
      const p = (j / segments) * Math.PI * 2;
      const y = Math.cos(p) * r, z = Math.sin(p) * r;
      positions.push(x, y, z);
      const n = normalize([x / (length / 2) ** 2, y / radius ** 2, z / radius ** 2]);
      normals.push(...n);
    }
  }
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < segments; j++) {
      const a = i * (segments + 1) + j;
      const b = a + segments + 1;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    colors: new Float32Array(positions.length),
    indices: new Uint32Array(indices),
  };
}

/** Flat disc on y = 0, used as a multiply-blended shadow. */
export function disc(radius: number, segments = 16, darkness = 0.45): Mesh {
  const positions: number[] = [0, 0, 0];
  const indices: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    positions.push(Math.cos(a) * radius, 0, Math.sin(a) * radius);
    if (i > 0) indices.push(0, i, i + 1);
  }
  const k = 1 - darkness;
  return {
    positions: new Float32Array(positions),
    colors: new Float32Array(positions.length).fill(k),
    indices: new Uint32Array(indices),
  };
}
