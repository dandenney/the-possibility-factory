import { describe, expect, it } from "vitest";
import { Quantizer, encodeGif, lzw, type RGB } from "./gif.ts";

/** Reference GIF LZW decoder for round-trip checks. */
function unlzw(data: Uint8Array, minCodeSize: number): number[] {
  const bytes: number[] = [];
  let p = 0;
  while (data[p]) {
    const n = data[p]!;
    bytes.push(...data.slice(p + 1, p + 1 + n));
    p += n + 1;
  }
  const clear = 1 << minCodeSize;
  const eoi = clear + 1;
  let size = minCodeSize + 1;
  let table: number[][] = [];
  const reset = () => {
    table = [];
    for (let i = 0; i < clear; i++) table[i] = [i];
    table[clear] = [];
    table[eoi] = [];
    size = minCodeSize + 1;
  };
  reset();
  const out: number[] = [];
  let bit = 0;
  let prev: number[] | undefined;
  for (;;) {
    let code = 0;
    for (let i = 0; i < size; i++, bit++) code |= ((bytes[bit >> 3]! >> (bit & 7)) & 1) << i;
    if (code === clear) {
      reset();
      prev = undefined;
      continue;
    }
    if (code === eoi) break;
    let entry: number[];
    if (code < table.length) entry = table[code]!;
    else entry = [...prev!, prev![0]!];
    out.push(...entry);
    if (prev) {
      table.push([...prev, entry[0]!]);
      if (table.length === 1 << size && size < 12) size++;
    }
    prev = entry;
  }
  return out;
}

describe("lzw", () => {
  it("round-trips flat, noisy and long inputs", () => {
    const cases: Uint8Array[] = [
      new Uint8Array([0]),
      new Uint8Array(5000).fill(3),
      Uint8Array.from({ length: 20000 }, (_, i) => (i * 7 + (i >> 5)) % 16),
      Uint8Array.from({ length: 60000 }, (_, i) => (Math.sin(i) * 1e4) & 15),
    ];
    for (const c of cases) expect(unlzw(lzw(c, 4), 4)).toEqual([...c]);
  });
});

describe("encodeGif", () => {
  it("writes a looping GIF89a with one image per frame", () => {
    const pal: RGB[] = [[255, 255, 255], [0, 0, 0], [228, 87, 46]];
    const frame = Uint8Array.from({ length: 64 }, (_, i) => i % 3);
    const gif = encodeGif(8, 8, pal, [{ indices: frame, delay: 8 }, { indices: frame.reverse(), delay: 100 }]);
    expect(new TextDecoder().decode(gif.slice(0, 6))).toBe("GIF89a");
    expect(gif[6]).toBe(8);
    expect(new TextDecoder().decode(gif)).toContain("NETSCAPE2.0");
    expect(gif.filter((b, i) => b === 0x2c && gif[i - 1] === 0 && gif[i - 2] === 0).length).toBeGreaterThanOrEqual(2);
    expect(gif.at(-1)).toBe(0x3b);
  });
});

describe("Quantizer", () => {
  it("snaps colours to the nearest palette entry", () => {
    const q = new Quantizer([[244, 241, 234], [28, 30, 34], [228, 87, 46]]);
    expect(q.nearest(250, 250, 250)).toBe(0);
    expect(q.nearest(10, 10, 10)).toBe(1);
    expect(q.nearest(240, 90, 40)).toBe(2);
    expect([...q.map(new Uint8Array([240, 240, 240, 255, 30, 30, 30, 255]))]).toEqual([0, 1]);
  });
});
