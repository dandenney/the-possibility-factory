import { formatScore, RULE_BY_ID, tierFor, type RuleId } from "./detect.ts";

export const CARD_W = 1200;
export const CARD_H = 630;

const C = {
  bg: "#111214",
  panel: "#1a1c20",
  ink: "#f2efe9",
  dim: "#9b9ea6",
  track: "#2a2d33",
};

const SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';

export function scoreColor(score: number): string {
  return score < 15 ? "#5ad07a" : score < 40 ? "#c8d65a" : score < 80 ? "#ffb224" : "#ff5d52";
}

export interface CardData {
  score: number;
  words: number;
  counts: [RuleId, number][];
  url: string;
}

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

export function drawCard(canvas: HTMLCanvasElement, d: CardData) {
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const g = canvas.getContext("2d")!;
  const tier = tierFor(d.score);
  const color = scoreColor(d.score);

  g.fillStyle = C.bg;
  g.fillRect(0, 0, CARD_W, CARD_H);
  g.fillStyle = C.panel;
  g.beginPath();
  g.roundRect(28, 28, CARD_W - 56, CARD_H - 56, 28);
  g.fill();

  // highlighter strokes across the top, one per habit colour
  const stripe = ["#ff6b6b", "#ff9f1c", "#ffd166", "#c77dff", "#4cc9f0", "#00f5d4", "#90be6d"];
  const sw = (CARD_W - 56) / stripe.length;
  stripe.forEach((c, i) => {
    g.fillStyle = c;
    g.fillRect(28 + i * sw, 28, sw + 1, 12);
  });

  g.textBaseline = "alphabetic";
  g.fillStyle = C.dim;
  g.font = `800 24px ${SANS}`;
  g.fillText("DESLOP DETECTOR", 72, 100);

  g.fillStyle = color;
  g.font = `900 168px ${MONO}`;
  const scoreText = formatScore(d.score);
  g.fillText(scoreText, 64, 280, 470);
  g.fillStyle = C.dim;
  g.font = `700 26px ${SANS}`;
  g.fillText("SLOP PER 1,000 WORDS", 72, 326);

  g.fillStyle = C.ink;
  g.font = `900 52px ${SANS}`;
  g.fillText(tier.title, 72, 410, 480);
  g.fillStyle = C.dim;
  g.font = `500 26px ${SANS}`;
  let y = 454;
  for (const line of wrap(g, tier.blurb, 470).slice(0, 2)) {
    g.fillText(line, 72, y);
    y += 36;
  }

  // breakdown
  const x = 620, maxW = CARD_W - x - 72;
  g.fillStyle = C.dim;
  g.font = `800 22px ${SANS}`;
  g.fillText(`TOP TICS IN ${d.words.toLocaleString("en-US")} WORDS`, x, 100);
  const top = d.counts.slice(0, 6);
  if (!top.length) {
    g.fillStyle = C.ink;
    g.font = `600 34px ${SANS}`;
    g.fillText("None. Not a single tic.", x, 170);
  }
  const most = Math.max(1, ...top.map(([, n]) => n));
  y = 150;
  for (const [id, n] of top) {
    const rule = RULE_BY_ID[id];
    g.fillStyle = C.ink;
    g.font = `600 26px ${SANS}`;
    g.fillText(rule.label, x, y);
    g.textAlign = "right";
    g.font = `800 26px ${MONO}`;
    g.fillText(`×${n}`, x + maxW, y);
    g.textAlign = "left";
    g.fillStyle = C.track;
    g.beginPath();
    g.roundRect(x, y + 12, maxW, 12, 6);
    g.fill();
    g.fillStyle = rule.color;
    g.beginPath();
    g.roundRect(x, y + 12, Math.max(12, (maxW * n) / most), 12, 6);
    g.fill();
    y += 66;
  }

  g.fillStyle = C.dim;
  g.font = `600 22px ${SANS}`;
  g.fillText(d.url.replace(/^https?:\/\//, "").replace(/\/$/, ""), 72, CARD_H - 62);
  g.textAlign = "right";
  g.fillText("People score under 15. Chatbots ~120.", CARD_W - 72, CARD_H - 62);
  g.textAlign = "left";
}

export function cardBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}
