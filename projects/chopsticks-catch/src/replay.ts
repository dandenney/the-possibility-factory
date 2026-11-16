import { FONT, Fx, GIF_PALETTE, INK, INK_SOFT, ACCENT, PAPER, RULE, render, viewFor } from "./draw.ts";
import { GifEncoder, Quantizer } from "./gif.ts";
import { ARMS_Y, type World } from "./sim.ts";

const SIZE = 360;
const FPS = 12;
const KEEP = 7 * FPS;
const AFTER = 1.8;

/** Keeps the last few seconds of the flight as indexed frames and turns them into a looping GIF. */
export class Recorder {
  private canvas = document.createElement("canvas");
  private g: CanvasRenderingContext2D;
  private q = new Quantizer(GIF_PALETTE);
  private frames: Uint8Array[] = [];
  private clock = 0;
  private after = 0;
  private flight: number;
  done = false;

  constructor(flight: number) {
    this.flight = flight;
    this.canvas.width = SIZE;
    this.canvas.height = SIZE;
    this.g = this.canvas.getContext("2d", { willReadFrequently: true })!;
  }

  /** Call once per rendered frame with sim seconds elapsed. Returns true when recording has finished. */
  tick(dt: number, w: World, fx: Fx, now: number): boolean {
    if (this.done || w.phase === "ready") return this.done;
    if (w.done) {
      this.after += dt;
      if (this.after > AFTER) {
        this.done = true;
        return true;
      }
    }
    this.clock += dt;
    if (this.clock < 1 / FPS) return false;
    this.clock %= 1 / FPS;
    const v = viewFor(w, SIZE, SIZE, 120);
    render(this.g, w, fx, v, now);
    this.caption(w);
    this.frames.push(this.q.map(this.g.getImageData(0, 0, SIZE, SIZE).data));
    if (this.frames.length > KEEP) this.frames.shift();
    return false;
  }

  private caption(w: World): void {
    const g = this.g;
    g.fillStyle = PAPER;
    g.fillRect(0, 0, SIZE, 48);
    g.fillStyle = RULE;
    g.fillRect(0, 48, SIZE, 1);
    g.fillStyle = INK;
    g.font = `600 15px ${FONT}`;
    g.textAlign = "left";
    g.textBaseline = "top";
    g.fillText("Chopsticks Catch", 12, 10);
    g.fillStyle = INK_SOFT;
    g.font = `500 12px ${FONT}`;
    g.fillText(`Flight ${this.flight}`, 12, 29);
    if (!w.done) {
      g.textAlign = "right";
      g.fillText(`${(w.y - ARMS_Y).toFixed(0)} m over arms · ${Math.abs(w.vy).toFixed(1)} m/s`, SIZE - 12, 10);
    }
  }

  private card(title: string, lines: string[]): Uint8Array {
    const g = this.g;
    g.fillStyle = PAPER;
    g.fillRect(0, 0, SIZE, SIZE);
    g.strokeStyle = RULE;
    g.lineWidth = 1;
    g.strokeRect(16.5, 16.5, SIZE - 33, SIZE - 33);
    g.textAlign = "left";
    g.textBaseline = "alphabetic";
    g.fillStyle = INK_SOFT;
    g.font = `500 14px ${FONT}`;
    g.fillText(`Chopsticks Catch · Flight ${this.flight}`, 36, 64);
    g.fillStyle = INK;
    g.font = `600 40px "Barlow Semi Condensed", ${FONT}`;
    g.fillText(title, 36, 150);
    g.fillStyle = ACCENT;
    g.fillRect(36, 166, 48, 3);
    g.fillStyle = INK;
    g.font = `500 18px ${FONT}`;
    lines.forEach((l, i) => g.fillText(l, 36, 206 + i * 28));
    g.fillStyle = INK_SOFT;
    g.font = `500 14px ${FONT}`;
    g.fillText("chopsticks-catch.netlify.app", 36, SIZE - 38);
    return this.q.map(g.getImageData(0, 0, SIZE, SIZE).data);
  }

  /** Encodes a frame at a time, yielding so the page keeps animating. */
  async encode(title: string, lines: string[]): Promise<Blob> {
    const enc = new GifEncoder(SIZE, SIZE, GIF_PALETTE);
    const delay = Math.round(100 / FPS);
    for (let i = 0; i < this.frames.length; i++) {
      enc.addFrame({ indices: this.frames[i]!, delay: i === this.frames.length - 1 ? 60 : delay });
      if (i % 6 === 5) await new Promise((r) => setTimeout(r, 0));
    }
    enc.addFrame({ indices: this.card(title, lines), delay: 260 });
    return new Blob([enc.finish() as BlobPart], { type: "image/gif" });
  }
}
