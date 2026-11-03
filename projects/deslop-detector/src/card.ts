import { formatScore, RULE_BY_ID, tierFor, type RuleId } from "./detect.ts";

export const CARD_W = 1200;
export const CARD_H = 630;

const C = {
  bg: "#f6f5f2",
  paper: "#ffffff",
  line: "#e4e2dd",
  ink: "#1d1f23",
  dim: "#6b6e75",
  track: "#efede9",
  flag: "#d6453d",
};

const SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const SERIF = '"Iowan Old Style", Charter, "Bitstream Charter", Georgia, serif';

export function tierColor(score: number): string {
  return score < 15 ? "#2f9e66" : score < 40 ? "#b8901c" : score < 80 ? "#d9731a" : "#d6453d";
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

  g.fillStyle = C.bg;
  g.fillRect(0, 0, CARD_W, CARD_H);
  g.fillStyle = C.paper;
  g.strokeStyle = C.line;
  g.lineWidth = 2;
  g.beginPath();
  g.roundRect(32, 32, CARD_W - 64, CARD_H - 64, 24);
  g.fill();
  g.stroke();

  g.textBaseline = "alphabetic";
  g.fillStyle = C.ink;
  g.font = `700 26px ${SANS}`;
  g.fillText("Deslop", 80, 104);
  const w = g.measureText("Deslop ").width;
  g.fillStyle = C.dim;
  g.font = `400 26px ${SANS}`;
  g.fillText("Detector", 80 + w, 104);

  g.fillStyle = C.ink;
  g.font = `600 176px ${SANS}`;
  g.fillText(formatScore(d.score), 72, 296, 480);
  g.fillStyle = C.dim;
  g.font = `400 26px ${SANS}`;
  g.fillText("slop per 1,000 words", 80, 342);

  g.fillStyle = tierColor(d.score);
  g.beginPath();
  g.arc(88, 409, 8, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = C.ink;
  g.font = `600 44px ${SERIF}`;
  g.fillText(tier.title, 108, 424, 440);
  g.fillStyle = C.dim;
  g.font = `400 25px ${SANS}`;
  let y = 466;
  for (const line of wrap(g, tier.blurb, 460).slice(0, 2)) {
    g.fillText(line, 80, y);
    y += 34;
  }

  // breakdown
  const x = 640, maxW = CARD_W - x - 80;
  g.fillStyle = C.dim;
  g.font = `400 22px ${SANS}`;
  g.fillText(`Top habits in ${d.words.toLocaleString("en-US")} words`, x, 104);
  const top = d.counts.slice(0, 6);
  if (!top.length) {
    g.fillStyle = C.ink;
    g.font = `400 32px ${SERIF}`;
    g.fillText("None. Not a single tic.", x, 170);
  }
  const most = Math.max(1, ...top.map(([, n]) => n));
  y = 160;
  for (const [id, n] of top) {
    g.fillStyle = C.ink;
    g.font = `400 26px ${SANS}`;
    g.fillText(RULE_BY_ID[id].label, x, y);
    g.textAlign = "right";
    g.fillStyle = C.dim;
    g.font = `600 26px ${SANS}`;
    g.fillText(String(n), x + maxW, y);
    g.textAlign = "left";
    g.fillStyle = C.track;
    g.fillRect(x, y + 14, maxW, 4);
    g.fillStyle = C.flag;
    g.fillRect(x, y + 14, Math.max(8, (maxW * n) / most), 4);
    y += 64;
  }

  g.fillStyle = C.dim;
  g.font = `400 22px ${SANS}`;
  g.fillText(d.url.replace(/^https?:\/\//, "").replace(/\/$/, ""), 80, CARD_H - 72);
  g.textAlign = "right";
  g.fillText("People score under 15. Chatbots ~120.", CARD_W - 80, CARD_H - 72);
  g.textAlign = "left";
}

export function cardBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}
