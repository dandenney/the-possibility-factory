import { describe, expect, it } from "vitest";
import { lookAt, multiply, perspective } from "./math.ts";
import { clipNear, Framebuffer, rgb, type Mesh } from "./raster.ts";

const quad = (z: number, color: [number, number, number]): Mesh => ({
  positions: new Float32Array([-1, -1, z, 1, -1, z, 1, 1, z, -1, 1, z]),
  colors: new Float32Array([...color, ...color, ...color, ...color]),
  indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
});

describe("Framebuffer", () => {
  const mvp = multiply(perspective(Math.PI / 2, 1, 0.1, 100), lookAt([0, 0, 3], [0, 0, 0]));

  it("fills a centered quad and leaves the corners clear", () => {
    const fb = new Framebuffer(32, 32);
    fb.clear(rgb(0, 0, 0));
    fb.drawMesh(quad(0, [1, 0, 0]), mvp);
    expect(fb.color[16 * 32 + 16]).toBe(rgb(255, 0, 0));
    expect(fb.color[0]).toBe(rgb(0, 0, 0));
    expect(fb.stats.triangles).toBe(2);
  });

  it("depth-tests regardless of draw order", () => {
    const fb = new Framebuffer(16, 16);
    fb.clear(rgb(0, 0, 0));
    fb.drawMesh(quad(1, [0, 1, 0]), mvp); // nearer
    fb.drawMesh(quad(-1, [0, 0, 1]), mvp); // farther, drawn second
    expect(fb.color[8 * 16 + 8]).toBe(rgb(0, 255, 0));
  });

  it("clips triangles crossing the near plane instead of dropping them", () => {
    const poly = clipNear([
      [0, 0, 0, 1, 0, 0, 1, 1, 1],
      [1, 0, 0, 1, 0, 0, 1, 1, 1],
      [0, 1, 0, -1, 0, 0, 1, 1, 1],
    ]);
    expect(poly).toHaveLength(4);
    expect(poly.every((v) => v[3] > 0)).toBe(true);
  });
});
