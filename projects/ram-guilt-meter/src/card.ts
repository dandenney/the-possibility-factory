import { formatCount, formatGb, type GuiltResult } from "./guilt.ts";

export const CARD_W = 1200;
export const CARD_H = 630;

const C = {
  bg: "#0e1014",
  panel: "#171a21",
  ink: "#f4efe6",
  dim: "#9aa0ab",
  green: "#3ddc84",
  amber: "#ffb224",
  red: "#ff4d3d",
};

export function scoreColor(score: number): string {
  return score >= 60 ? C.red : score >= 35 ? C.amber : C.green;
}

const SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';

function wrap(g: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (g.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

function gauge(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, score: number) {
  const start = Math.PI, end = 2 * Math.PI;
  g.lineCap = "round";
  g.lineWidth = 34;
  g.strokeStyle = "#262a33";
  g.beginPath();
  g.arc(cx, cy, r, start, end);
  g.stroke();

  const grad = g.createLinearGradient(cx - r, 0, cx + r, 0);
  grad.addColorStop(0, C.green);
  grad.addColorStop(0.5, C.amber);
  grad.addColorStop(1, C.red);
  g.strokeStyle = grad;
  g.beginPath();
  g.arc(cx, cy, r, start, start + (Math.PI * Math.max(score, 1)) / 100);
  g.stroke();

  for (let i = 0; i <= 10; i++) {
    const a = start + (Math.PI * i) / 10;
    const inner = r - 36, outer = r - (i % 5 === 0 ? 58 : 48);
    g.strokeStyle = "#3a3f4a";
    g.lineWidth = i % 5 === 0 ? 4 : 2;
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
    g.lineTo(cx + Math.cos(a) * outer, cy + Math.sin(a) * outer);
    g.stroke();
  }

  const a = start + (Math.PI * score) / 100;
  g.strokeStyle = C.ink;
  g.lineWidth = 6;
  g.beginPath();
  g.moveTo(cx, cy);
  g.lineTo(cx + Math.cos(a) * (r - 64), cy + Math.sin(a) * (r - 64));
  g.stroke();
  g.fillStyle = C.ink;
  g.beginPath();
  g.arc(cx, cy, 12, 0, Math.PI * 2);
  g.fill();
}

export interface CardOptions {
  url: string;
  donated?: boolean;
}

export function drawCard(canvas: HTMLCanvasElement, r: GuiltResult, opts: CardOptions) {
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const g = canvas.getContext("2d")!;
  const color = scoreColor(r.score);

  g.fillStyle = C.bg;
  g.fillRect(0, 0, CARD_W, CARD_H);
  g.fillStyle = C.panel;
  g.beginPath();
  g.roundRect(28, 28, CARD_W - 56, CARD_H - 56, 28);
  g.fill();
  // hazard stripe
  g.save();
  g.beginPath();
  g.rect(28, 28, CARD_W - 56, 14);
  g.clip();
  for (let x = 0; x < CARD_W; x += 40) {
    g.fillStyle = C.amber;
    g.beginPath();
    g.moveTo(x, 28);
    g.lineTo(x + 20, 28);
    g.lineTo(x + 6, 42);
    g.lineTo(x - 14, 42);
    g.fill();
  }
  g.restore();

  g.textBaseline = "alphabetic";
  g.fillStyle = C.dim;
  g.font = `800 24px ${SANS}`;
  g.fillText("RAM GUILT METER", 72, 96);
  if (r.input.measuredMb) {
    const w = g.measureText("RAM GUILT METER").width;
    g.font = `800 18px ${SANS}`;
    const tag = "MEASURED";
    const tw = g.measureText(tag).width + 20;
    g.strokeStyle = C.green;
    g.fillStyle = C.green;
    g.lineWidth = 2;
    g.beginPath();
    g.roundRect(72 + w + 14, 74, tw, 28, 6);
    g.stroke();
    g.fillText(tag, 72 + w + 24, 95);
  }

  const cx = 312, cy = 330;
  gauge(g, cx, cy, 190, r.score);
  g.textAlign = "center";
  g.fillStyle = color;
  g.font = `900 104px ${MONO}`;
  g.fillText(String(r.score), cx, cy + 120);
  g.fillStyle = C.dim;
  g.font = `700 24px ${SANS}`;
  g.fillText("GUILT OUT OF 100", cx, cy + 164);
  g.textAlign = "left";

  const x = 600, maxW = CARD_W - x - 72;
  g.fillStyle = color;
  g.font = `900 56px ${SANS}`;
  g.fillText(r.tier.title, x, 150, maxW);

  g.fillStyle = C.ink;
  g.font = `500 28px ${SANS}`;
  let y = 200;
  for (const line of wrap(g, r.quip, maxW).slice(0, 3)) {
    g.fillText(line, x, y);
    y += 38;
  }

  const stats: [string, string][] = [
    [`${r.input.tabs}`, r.input.tabs === 1 ? "tab open" : "tabs open"],
    [formatGb(r.hoardedGb), r.input.measuredMb ? "of DRAM hoarded (measured)" : "of DRAM hoarded"],
    [formatCount(r.kvTokens), "tokens of KV cache it could hold"],
    [formatCount(r.replies), "chatbot replies left unwritten"],
  ];
  y = Math.max(y + 24, 340);
  for (const [value, label] of stats) {
    g.font = `800 34px ${MONO}`;
    g.fillStyle = C.ink;
    g.fillText(value, x, y);
    const w = g.measureText(value).width;
    g.font = `500 24px ${SANS}`;
    g.fillStyle = C.dim;
    g.fillText(label, x + w + 14, y, maxW - w - 14);
    y += 52;
  }

  g.fillStyle = C.dim;
  g.font = `600 22px ${SANS}`;
  g.fillText(opts.url.replace(/^https?:\/\//, ""), 72, CARD_H - 62);
  g.textAlign = "right";
  g.fillText("Satire. Not affiliated with OpenAI.", CARD_W - 72, CARD_H - 62);
  g.textAlign = "left";

  if (opts.donated) {
    g.save();
    g.translate(470, 120);
    g.rotate(-0.18);
    g.strokeStyle = C.green;
    g.fillStyle = C.green;
    g.lineWidth = 6;
    g.beginPath();
    g.roundRect(-110, -40, 220, 80, 12);
    g.stroke();
    g.font = `900 34px ${SANS}`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("RAM DONOR", 0, 2);
    g.restore();
  }
}

export function cardBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}
