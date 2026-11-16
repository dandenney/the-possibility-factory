// A small animated GIF89a encoder for indexed frames that share one global palette.

export type RGB = [number, number, number];

class ByteWriter {
  private buf = new Uint8Array(1 << 16);
  length = 0;
  byte(b: number) {
    if (this.length === this.buf.length) {
      const next = new Uint8Array(this.buf.length * 2);
      next.set(this.buf);
      this.buf = next;
    }
    this.buf[this.length++] = b;
  }
  word(w: number) {
    this.byte(w & 0xff);
    this.byte((w >> 8) & 0xff);
  }
  bytes(list: ArrayLike<number>) {
    for (let i = 0; i < list.length; i++) this.byte(list[i]!);
  }
  result(): Uint8Array {
    return this.buf.slice(0, this.length);
  }
}

/** GIF-flavoured LZW: variable code width, LSB-first, codes packed into ≤255-byte sub-blocks. */
export function lzw(indices: Uint8Array, minCodeSize: number): Uint8Array {
  const out = new ByteWriter();
  const clear = 1 << minCodeSize;
  const eoi = clear + 1;
  let next = eoi + 1;
  let size = minCodeSize + 1;
  let dict = new Map<number, number>();
  let bitBuf = 0;
  let bitCount = 0;
  const block: number[] = [];
  const flushBlock = () => {
    out.byte(block.length);
    out.bytes(block);
    block.length = 0;
  };
  const emit = (code: number) => {
    bitBuf |= code << bitCount;
    bitCount += size;
    while (bitCount >= 8) {
      block.push(bitBuf & 0xff);
      if (block.length === 255) flushBlock();
      bitBuf >>>= 8;
      bitCount -= 8;
    }
  };
  emit(clear);
  if (indices.length) {
    let prefix = indices[0]!;
    for (let i = 1; i < indices.length; i++) {
      const k = indices[i]!;
      const key = prefix * 256 + k;
      const hit = dict.get(key);
      if (hit !== undefined) {
        prefix = hit;
        continue;
      }
      emit(prefix);
      if (next === 4096) {
        emit(clear);
        dict = new Map();
        next = eoi + 1;
        size = minCodeSize + 1;
      } else {
        if (next >= 1 << size) size++;
        dict.set(key, next++);
      }
      prefix = k;
    }
    emit(prefix);
  }
  emit(eoi);
  if (bitCount > 0) block.push(bitBuf & 0xff);
  if (block.length) flushBlock();
  out.byte(0);
  return out.result();
}

export interface GifFrame {
  indices: Uint8Array;
  /** Delay in hundredths of a second. */
  delay: number;
}

export class GifEncoder {
  private w = new ByteWriter();
  private bits: number;
  readonly width: number;
  readonly height: number;

  constructor(width: number, height: number, palette: RGB[]) {
    this.width = width;
    this.height = height;
    let bits = 1;
    while (1 << bits < palette.length) bits++;
    this.bits = Math.max(2, bits);
    const w = this.w;
    w.bytes([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
    w.word(width);
    w.word(height);
    w.byte(0x80 | ((this.bits - 1) << 4) | (this.bits - 1));
    w.byte(0);
    w.byte(0);
    for (let i = 0; i < 1 << this.bits; i++) w.bytes(palette[i] ?? [0, 0, 0]);
    // NETSCAPE2.0: loop forever.
    w.bytes([0x21, 0xff, 0x0b, ...[..."NETSCAPE2.0"].map((c) => c.charCodeAt(0)), 0x03, 0x01, 0x00, 0x00, 0x00]);
  }

  addFrame({ indices, delay }: GifFrame): void {
    const w = this.w;
    w.bytes([0x21, 0xf9, 0x04, 0x00]);
    w.word(delay);
    w.bytes([0x00, 0x00]);
    w.byte(0x2c);
    w.word(0);
    w.word(0);
    w.word(this.width);
    w.word(this.height);
    w.byte(0);
    w.byte(this.bits);
    w.bytes(lzw(indices, this.bits));
  }

  finish(): Uint8Array {
    this.w.byte(0x3b);
    return this.w.result();
  }
}

export function encodeGif(width: number, height: number, palette: RGB[], frames: GifFrame[]): Uint8Array {
  const enc = new GifEncoder(width, height, palette);
  for (const f of frames) enc.addFrame(f);
  return enc.finish();
}

/** Maps RGBA pixels to the nearest palette entry, caching per 15-bit colour. */
export class Quantizer {
  private lut = new Uint8Array(32768).fill(255);
  readonly palette: RGB[];
  constructor(palette: RGB[]) {
    this.palette = palette;
  }

  nearest(r: number, g: number, b: number): number {
    const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    let idx = this.lut[key]!;
    if (idx !== 255) return idx;
    let best = Infinity;
    idx = 0;
    for (let i = 0; i < this.palette.length; i++) {
      const [pr, pg, pb] = this.palette[i]!;
      const d = 0.3 * (r - pr) ** 2 + 0.59 * (g - pg) ** 2 + 0.11 * (b - pb) ** 2;
      if (d < best) {
        best = d;
        idx = i;
      }
    }
    this.lut[key] = idx;
    return idx;
  }

  map(rgba: Uint8ClampedArray | Uint8Array): Uint8Array {
    const out = new Uint8Array(rgba.length / 4);
    for (let i = 0, p = 0; i < out.length; i++, p += 4) out[i] = this.nearest(rgba[p]!, rgba[p + 1]!, rgba[p + 2]!);
    return out;
  }
}
