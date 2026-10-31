import { FIELD_WIDTH, type Play, type Team } from "./espn.ts";
import { hexColor, type Texture } from "./raster.ts";

/** Texture extents in world yards: end zones plus a strip of sideline. */
export const X_MIN = -14;
export const X_MAX = 114;
export const Z_MIN = -5;
export const Z_MAX = FIELD_WIDTH + 5;
const PX_PER_YARD = 8;
const HEAT_PER_YARD = 2;

export function luminance([r, g, b]: [number, number, number]): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/** A team color that reads on dark green grass. */
export function displayColor(team: Team): [number, number, number] {
  const primary = hexColor(team.color);
  const [r, g, b] = primary;
  const saturation = (Math.max(r, g, b) - Math.min(r, g, b)) / (Math.max(r, g, b) || 1);
  const lum = luminance(primary);
  return lum < 0.06 || (lum < 0.2 && saturation < 0.35) ? hexColor(team.altColor, "dddddd") : primary;
}

/** Paint the field with Canvas 2D once (lines, numbers, end zones), then hand back raw pixels. */
export function paintField(home: Team, away: Team): Texture {
  const width = (X_MAX - X_MIN) * PX_PER_YARD;
  const height = Math.round((Z_MAX - Z_MIN) * PX_PER_YARD);
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d")!;
  const X = (x: number) => (x - X_MIN) * PX_PER_YARD;
  const Z = (z: number) => (z - Z_MIN) * PX_PER_YARD;
  const S = PX_PER_YARD;

  ctx.fillStyle = "#24582c";
  ctx.fillRect(0, 0, width, height);
  for (let x = 0; x < 100; x += 5) {
    ctx.fillStyle = (x / 5) % 2 ? "#2d6a35" : "#327a3b";
    ctx.fillRect(X(x), Z(0), 5 * S, FIELD_WIDTH * S);
  }

  const endZone = (team: Team, x0: number, rotate: number) => {
    ctx.fillStyle = `#${team.color}`;
    ctx.fillRect(X(x0), Z(0), 10 * S, FIELD_WIDTH * S);
    ctx.save();
    ctx.translate(X(x0 + 5), Z(FIELD_WIDTH / 2));
    ctx.rotate(rotate);
    ctx.fillStyle = `#${luminance(hexColor(team.color)) < 0.5 ? team.altColor : "111111"}`;
    ctx.font = `900 ${6 * S}px "Arial Black", Impact, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(team.shortName.toUpperCase().slice(0, 12), 0, 0, FIELD_WIDTH * S * 0.85);
    ctx.restore();
  };
  endZone(home, -10, -Math.PI / 2);
  endZone(away, 100, Math.PI / 2);

  ctx.strokeStyle = "rgba(255,255,255,0.92)";
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.lineWidth = Math.max(2, S * 0.35);
  ctx.strokeRect(X(-10), Z(0), 120 * S, FIELD_WIDTH * S);
  for (let x = 0; x <= 100; x += 5) {
    ctx.beginPath();
    ctx.moveTo(X(x), Z(0));
    ctx.lineTo(X(x), Z(FIELD_WIDTH));
    ctx.stroke();
  }
  for (let x = 1; x < 100; x++) {
    if (x % 5 === 0) continue;
    for (const z of [0.3, 20, FIELD_WIDTH - 20 - 0.7, FIELD_WIDTH - 1]) ctx.fillRect(X(x) - 1, Z(z), 2, 0.7 * S);
  }

  ctx.font = `700 ${2.4 * S}px "Arial Narrow", Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let x = 10; x < 100; x += 10) {
    const label = String(x <= 50 ? x : 100 - x);
    ctx.fillText(label, X(x), Z(FIELD_WIDTH - 9));
    ctx.save();
    ctx.translate(X(x), Z(9));
    ctx.rotate(Math.PI);
    ctx.fillText(label, 0, 0);
    ctx.restore();
  }

  const img = ctx.getImageData(0, 0, width, height);
  return { width, height, data: new Uint32Array(img.data.buffer.slice(0)) };
}

/** Accumulates where each team's plays ended and tints the field with it. */
export class Heatmap {
  readonly width = (X_MAX - X_MIN) * HEAT_PER_YARD;
  readonly height = Math.round((Z_MAX - Z_MIN) * HEAT_PER_YARD);
  private home = new Float32Array(this.width * this.height);
  private away = new Float32Array(this.width * this.height);

  constructor(
    private readonly base: Texture,
    private readonly homeColor: [number, number, number],
    private readonly awayColor: [number, number, number],
  ) {}

  /** Rebuild from plays[0..count) and return the composited field texture. */
  render(plays: Play[], count: number, out: Texture) {
    this.home.fill(0);
    this.away.fill(0);
    const radius = 3.2 * HEAT_PER_YARD;
    const sigma2 = 2 * (radius / 2) ** 2;
    for (let i = 0; i < count; i++) {
      const p = plays[i]!;
      if (!p.offense || (p.kind !== "rush" && p.kind !== "pass")) continue;
      const grid = p.offense === "home" ? this.home : this.away;
      const weight = 0.5 + Math.min(1.5, Math.max(0, p.yards) / 12);
      const cx = (p.endX - X_MIN) * HEAT_PER_YARD;
      const cy = (p.lane - Z_MIN) * HEAT_PER_YARD;
      for (let y = Math.max(0, Math.floor(cy - radius)); y <= Math.min(this.height - 1, Math.ceil(cy + radius)); y++) {
        for (let x = Math.max(0, Math.floor(cx - radius)); x <= Math.min(this.width - 1, Math.ceil(cx + radius)); x++) {
          const d2 = (x - cx) ** 2 + (y - cy) ** 2;
          grid[y * this.width + x]! += weight * Math.exp(-d2 / sigma2);
        }
      }
    }

    const { base } = this;
    const scale = base.width / this.width;
    // Lift team colors toward white so dark primaries still glow on the grass.
    const lift = (c: [number, number, number]) => c.map((v) => v + (255 - v) * 0.3) as [number, number, number];
    const [hr, hg, hb] = lift(this.homeColor);
    const [ar, ag, ab] = lift(this.awayColor);
    for (let y = 0; y < base.height; y++) {
      const gy = Math.min(this.height - 1, (y / scale) | 0);
      for (let x = 0; x < base.width; x++) {
        const gi = gy * this.width + Math.min(this.width - 1, (x / scale) | 0);
        const h = Math.min(0.85, this.home[gi]! * 0.45);
        const a = Math.min(0.85, this.away[gi]! * 0.45);
        const i = y * base.width + x;
        const c = base.data[i]!;
        if (h + a < 0.01) {
          out.data[i] = c;
          continue;
        }
        let r = c & 255, g = (c >>> 8) & 255, b = (c >>> 16) & 255;
        r += (hr - r) * h; g += (hg - g) * h; b += (hb - b) * h;
        r += (ar - r) * a; g += (ag - g) * a; b += (ab - b) * a;
        out.data[i] = (0xff000000 | ((b | 0) << 16) | ((g | 0) << 8) | (r | 0)) >>> 0;
      }
    }
  }
}

/** Speckled crowd texture for the grandstand. */
export function crowdTexture(seed = 7): Texture {
  const width = 256, height = 64;
  const data = new Uint32Array(width * height);
  let s = seed;
  const rand = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const palette = [[40, 40, 52], [70, 64, 70], [150, 40, 40], [230, 230, 230], [210, 170, 40], [40, 60, 120], [25, 25, 30]];
  for (let y = 0; y < height; y++) {
    const rowDark = y % 4 === 3 ? 0.55 : 1;
    for (let x = 0; x < width; x++) {
      const c = palette[(rand() * palette.length) | 0]!;
      const k = rowDark * (0.6 + rand() * 0.4);
      data[y * width + x] = (0xff000000 | (((c[2]! * k) | 0) << 16) | (((c[1]! * k) | 0) << 8) | ((c[0]! * k) | 0)) >>> 0;
    }
  }
  return { width, height, data };
}
