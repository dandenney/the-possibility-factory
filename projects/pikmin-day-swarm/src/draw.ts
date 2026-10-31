import { mulberry32, stageOf, strengthOf, type Item, type Sprout, type World } from "./sim.ts";
import type { SproutType } from "./types.ts";

/** Paint the static lawn once per size. */
export function paintGarden(w: number, h: number, dpr: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = Math.round(w * dpr);
  c.height = Math.round(h * dpr);
  const g = c.getContext("2d")!;
  g.scale(dpr, dpr);
  const rand = mulberry32(42);
  const bg = g.createRadialGradient(w / 2, h / 2, 50, w / 2, h / 2, Math.max(w, h) * 0.75);
  bg.addColorStop(0, "#6fae4a");
  bg.addColorStop(1, "#3f7a32");
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  // Mottled patches.
  for (let i = 0; i < (w * h) / 9000; i++) {
    g.fillStyle = rand() < 0.5 ? "rgba(255,255,200,0.05)" : "rgba(0,40,0,0.06)";
    g.beginPath();
    g.ellipse(rand() * w, rand() * h, 20 + rand() * 60, 12 + rand() * 40, rand() * 3, 0, Math.PI * 2);
    g.fill();
  }
  // Blades.
  g.lineCap = "round";
  for (let i = 0; i < (w * h) / 120; i++) {
    const x = rand() * w, y = rand() * h, l = 3 + rand() * 5;
    g.strokeStyle = rand() < 0.5 ? "rgba(30,80,25,0.35)" : "rgba(170,220,120,0.25)";
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (rand() - 0.5) * 3, y - l);
    g.stroke();
  }
  // Clover and tiny flowers.
  for (let i = 0; i < (w * h) / 14000; i++) {
    const x = rand() * w, y = rand() * h;
    if (rand() < 0.6) {
      g.fillStyle = "rgba(40,110,40,0.55)";
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * Math.PI * 2;
        g.beginPath();
        g.arc(x + Math.cos(a) * 3, y + Math.sin(a) * 3, 3, 0, Math.PI * 2);
        g.fill();
      }
    } else {
      g.fillStyle = ["#fff6e0", "#ffd6e8", "#fff3a0"][(rand() * 3) | 0]!;
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2;
        g.beginPath();
        g.arc(x + Math.cos(a) * 2.4, y + Math.sin(a) * 2.4, 1.7, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = "#f2b400";
      g.beginPath();
      g.arc(x, y, 1.4, 0, Math.PI * 2);
      g.fill();
    }
  }
  // Pebbles.
  for (let i = 0; i < (w * h) / 40000; i++) {
    const x = rand() * w, y = rand() * h, r = 3 + rand() * 6;
    g.fillStyle = "rgba(0,0,0,0.15)";
    g.beginPath();
    g.ellipse(x + 1, y + 2, r, r * 0.6, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = `hsl(${30 + rand() * 20} 10% ${60 + rand() * 20}%)`;
    g.beginPath();
    g.ellipse(x, y, r, r * 0.65, rand(), 0, Math.PI * 2);
    g.fill();
  }
  return c;
}

export function colorOf(type: SproutType, id: number, time: number): string {
  return type.color === "rainbow" ? `hsl(${(id * 37 + time * 120) % 360} 85% 60%)` : type.color;
}

function drawPuddles(g: CanvasRenderingContext2D, world: World, time: number) {
  for (const p of world.puddles) {
    g.save();
    g.fillStyle = "rgba(0,0,0,0.12)";
    g.beginPath();
    g.ellipse(p.x, p.y + 4, p.rx + 6, p.ry + 5, 0, 0, Math.PI * 2);
    g.fill();
    const grad = g.createRadialGradient(p.x - p.rx * 0.3, p.y - p.ry * 0.4, 5, p.x, p.y, p.rx);
    grad.addColorStop(0, "#8fd3ff");
    grad.addColorStop(1, "#2f7fc4");
    g.fillStyle = grad;
    g.beginPath();
    g.ellipse(p.x, p.y, p.rx, p.ry, 0, 0, Math.PI * 2);
    g.fill();
    g.clip();
    g.strokeStyle = "rgba(255,255,255,0.35)";
    g.lineWidth = 1.5;
    for (let k = 0; k < 3; k++) {
      const u = (time * 0.35 + k / 3) % 1;
      g.globalAlpha = 1 - u;
      g.beginPath();
      g.ellipse(p.x + Math.sin(k * 2.1) * p.rx * 0.3, p.y + Math.cos(k * 1.7) * p.ry * 0.3, 8 + u * p.rx * 0.6, 5 + u * p.ry * 0.6, 0, 0, Math.PI * 2);
      g.stroke();
    }
    g.restore();
    g.strokeStyle = "rgba(220,240,255,0.7)";
    g.lineWidth = 2;
    g.beginPath();
    g.ellipse(p.x, p.y, p.rx, p.ry, 0, 0, Math.PI * 2);
    g.stroke();
  }
}

function drawOnion(g: CanvasRenderingContext2D, world: World, time: number) {
  const { x, y, r, pile, pulse } = world.onion;
  const bob = Math.sin(time * 1.6) * 3;
  g.fillStyle = "rgba(0,0,0,0.22)";
  g.beginPath();
  g.ellipse(x, y + r * 0.7, r * 1.5, r * 0.5, 0, 0, Math.PI * 2);
  g.fill();
  // Legs.
  g.strokeStyle = "#6b4a2a";
  g.lineWidth = 4;
  g.lineCap = "round";
  for (const a of [-2.3, -0.84, Math.PI / 2]) {
    g.beginPath();
    g.moveTo(x, y - r * 0.2 + bob);
    g.lineTo(x + Math.cos(a) * r * 1.4, y + r * 0.7);
    g.stroke();
  }
  // Glow when something lands.
  if (pulse > 0) {
    g.fillStyle = `rgba(255,240,150,${pulse * 0.5})`;
    g.beginPath();
    g.arc(x, y - r * 0.5 + bob, r * (1.4 + (1 - pulse) * 0.8), 0, Math.PI * 2);
    g.fill();
  }
  // Bulb.
  const by = y - r * 0.6 + bob;
  const grad = g.createRadialGradient(x - r * 0.35, by - r * 0.4, 4, x, by, r * 1.1);
  grad.addColorStop(0, "#ffd27a");
  grad.addColorStop(0.55, "#f07a2a");
  grad.addColorStop(1, "#b8401c");
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(x, by - r * 1.15);
  g.bezierCurveTo(x + r * 1.25, by - r * 0.4, x + r * 1.05, by + r * 0.75, x, by + r * 0.8);
  g.bezierCurveTo(x - r * 1.05, by + r * 0.75, x - r * 1.25, by - r * 0.4, x, by - r * 1.15);
  g.fill();
  g.strokeStyle = "rgba(120,40,10,0.35)";
  g.lineWidth = 1.5;
  for (const k of [-0.45, 0, 0.45]) {
    g.beginPath();
    g.moveTo(x, by - r * 1.1);
    g.quadraticCurveTo(x + k * r * 1.6, by, x, by + r * 0.78);
    g.stroke();
  }
  // Petal antenna.
  const ty = by - r * 1.15;
  g.strokeStyle = "#3b7d2a";
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(x, ty);
  g.lineTo(x, ty - 14);
  g.stroke();
  for (let k = 0; k < 3; k++) {
    const a = time * 2 + (k / 3) * Math.PI * 2;
    g.fillStyle = "#fff3b0";
    g.beginPath();
    g.ellipse(x + Math.cos(a) * 7, ty - 14, 6, 2.5, a, 0, Math.PI * 2);
    g.fill();
  }
  // The crumb pile riding on top.
  const shown = Math.min(pile, 28);
  for (let i = 0; i < shown; i++) {
    const row = Math.floor(Math.sqrt(i * 2));
    const a = i * 2.4;
    g.fillStyle = ["#d9a35b", "#c98a46", "#d6263b", "#f5c518"][i % 4]!;
    g.beginPath();
    g.arc(x + Math.cos(a) * (10 - row * 1.2), ty - 20 - row * 4 + Math.sin(a) * 2, 3.2, 0, Math.PI * 2);
    g.fill();
  }
  if (pile > 0) {
    g.font = "800 12px ui-rounded, 'SF Pro Rounded', system-ui, sans-serif";
    g.textAlign = "center";
    g.fillStyle = "#fffbe8";
    g.strokeStyle = "rgba(60,30,10,0.7)";
    g.lineWidth = 3;
    const label = `${pile} home`;
    g.strokeText(label, x, y + r * 1.35);
    g.fillText(label, x, y + r * 1.35);
  }
}

function drawItem(g: CanvasRenderingContext2D, item: Item) {
  const { x, y, r, kind, color } = item;
  const lift = item.moving ? 3 : 0;
  g.fillStyle = "rgba(0,0,0,0.2)";
  g.beginPath();
  g.ellipse(x, y + r * 0.45, r * 1.05, r * 0.45, 0, 0, Math.PI * 2);
  g.fill();
  const cy = y - lift;
  if (kind === "pellet" || kind === "candy") {
    g.fillStyle = color;
    g.beginPath();
    g.arc(x, cy, r, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "rgba(255,255,255,0.3)";
    g.beginPath();
    g.arc(x - r * 0.3, cy - r * 0.3, r * 0.45, 0, Math.PI * 2);
    g.fill();
    if (kind === "candy") {
      g.fillStyle = color;
      for (const s of [-1, 1]) {
        g.beginPath();
        g.moveTo(x + s * r * 0.9, cy);
        g.lineTo(x + s * r * 1.6, cy - r * 0.6);
        g.lineTo(x + s * r * 1.6, cy + r * 0.6);
        g.fill();
      }
    }
    g.font = `900 ${Math.round(r * 0.9)}px ui-rounded, 'SF Pro Rounded', system-ui, sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillStyle = "#fff";
    g.fillText(String(item.weight), x, cy + 1);
  } else if (kind === "berry") {
    g.fillStyle = color;
    g.beginPath();
    g.arc(x, cy, r, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "rgba(255,255,255,0.45)";
    g.beginPath();
    g.arc(x - r * 0.35, cy - r * 0.35, r * 0.25, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#3b7d2a";
    g.beginPath();
    g.ellipse(x + 2, cy - r, 4, 2, -0.5, 0, Math.PI * 2);
    g.fill();
  } else {
    g.fillStyle = color;
    g.beginPath();
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2;
      const rr = r * (0.86 + ((k * 7) % 3) * 0.08);
      k === 0 ? g.moveTo(x + Math.cos(a) * rr, cy + Math.sin(a) * rr) : g.lineTo(x + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    g.closePath();
    g.fill();
    if (kind === "cookie") {
      g.fillStyle = "#4a2a14";
      for (const [dx, dy] of [[-0.4, -0.2], [0.3, -0.35], [0.1, 0.3], [-0.2, 0.45], [0.5, 0.15]] as const) {
        g.beginPath();
        g.arc(x + dx * r, cy + dy * r, r * 0.12, 0, Math.PI * 2);
        g.fill();
      }
    }
  }
  if (item.carriers.length > 0) {
    const label = `${strengthOf(item.carriers)}/${item.weight}`;
    g.font = "800 11px ui-rounded, 'SF Pro Rounded', system-ui, sans-serif";
    g.textAlign = "center";
    g.textBaseline = "alphabetic";
    g.lineWidth = 3;
    g.strokeStyle = "rgba(0,0,0,0.55)";
    g.fillStyle = item.moving ? "#c7ff8a" : "#fff";
    g.strokeText(label, x, cy - r - 8);
    g.fillText(label, x, cy - r - 8);
  }
}

function drawSprout(g: CanvasRenderingContext2D, s: Sprout, time: number, world: World) {
  const size = 5 * s.type.size;
  const color = colorOf(s.type, s.id, time);
  const wading = s.z === 0 && s.type.swims && world.inPuddle(s.x, s.y);
  const walk = s.state === "follow" || s.state === "charge" || s.state === "carry" ? Math.sin(time * 14 + s.phase) * 1.2 : 0;
  const x = s.x, y = s.y - s.z;
  // Shadow.
  g.fillStyle = s.z > 0 ? "rgba(0,0,0,0.15)" : "rgba(0,0,0,0.25)";
  g.beginPath();
  g.ellipse(s.x, s.y + size * 0.9, size * (s.z > 0 ? 0.7 : 1), size * 0.4, 0, 0, Math.PI * 2);
  g.fill();
  if (s.type.glow) {
    g.fillStyle = "rgba(255,255,220,0.25)";
    g.beginPath();
    g.arc(x, y - size * 0.4, size * 2.4, 0, Math.PI * 2);
    g.fill();
  }
  if (wading) {
    g.strokeStyle = "rgba(255,255,255,0.6)";
    g.lineWidth = 1;
    g.beginPath();
    g.ellipse(s.x, s.y + size * 0.5, size * 1.5, size * 0.6, 0, 0, Math.PI * 2);
    g.stroke();
  }
  // Body: a little teardrop.
  g.fillStyle = color;
  g.beginPath();
  g.ellipse(x, y - size * 0.2 + walk * 0.3, size * 0.75, size * 1.05, 0, 0, Math.PI * 2);
  g.fill();
  // Eyes look where they're going.
  const ex = Math.cos(s.face) * size * 0.25, ey = Math.sin(s.face) * size * 0.15;
  g.fillStyle = "#fff";
  for (const side of [-1, 1]) {
    g.beginPath();
    g.arc(x + side * size * 0.32 + ex * 0.5, y - size * 0.55 + ey * 0.5, size * 0.26, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = "#111";
  for (const side of [-1, 1]) {
    g.beginPath();
    g.arc(x + side * size * 0.32 + ex, y - size * 0.55 + ey, size * 0.13, 0, Math.PI * 2);
    g.fill();
  }
  // Stem with leaf, bud, or flower.
  const top = y - size * 1.25;
  const sway = Math.sin(time * 3 + s.phase) * 2 + walk;
  const tipX = x + sway, tipY = top - size * 1.5;
  g.strokeStyle = "#2f6a24";
  g.lineWidth = 1.2;
  g.beginPath();
  g.moveTo(x, top);
  g.quadraticCurveTo(x + sway * 0.3, top - size, tipX, tipY);
  g.stroke();
  const stage = stageOf(s.age);
  if (stage === 0) {
    g.fillStyle = "#5fc94a";
    g.beginPath();
    g.ellipse(tipX + 2, tipY - 1, size * 0.65, size * 0.3, -0.6, 0, Math.PI * 2);
    g.fill();
  } else if (stage === 1) {
    g.fillStyle = "#ffe2ef";
    g.beginPath();
    g.ellipse(tipX, tipY - 1, size * 0.35, size * 0.5, 0, 0, Math.PI * 2);
    g.fill();
  } else {
    g.fillStyle = s.type.id === "white" ? "#ffd1e6" : "#fffdf5";
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 + s.phase;
      g.beginPath();
      g.arc(tipX + Math.cos(a) * size * 0.45, tipY + Math.sin(a) * size * 0.45, size * 0.33, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = "#f5c518";
    g.beginPath();
    g.arc(tipX, tipY, size * 0.25, 0, Math.PI * 2);
    g.fill();
  }
}

function drawLeader(g: CanvasRenderingContext2D, world: World, time: number, aimRange: number) {
  const { leader } = world;
  // Aim reticle and throw arc.
  const dx = leader.aimX - leader.x, dy = leader.aimY - leader.y;
  const d = Math.hypot(dx, dy);
  const max = 300 * aimRange;
  const ax = d > max ? leader.x + (dx / d) * max : leader.aimX;
  const ay = d > max ? leader.y + (dy / d) * max : leader.aimY;
  g.setLineDash([4, 6]);
  g.strokeStyle = "rgba(255,255,255,0.55)";
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(leader.x, leader.y - 10);
  g.quadraticCurveTo((leader.x + ax) / 2, Math.min(leader.y, ay) - 50, ax, ay);
  g.stroke();
  g.setLineDash([]);
  g.strokeStyle = "rgba(255,255,255,0.85)";
  g.beginPath();
  g.arc(ax, ay, 9 + Math.sin(time * 6) * 1.5, 0, Math.PI * 2);
  g.stroke();

  if (leader.whistling) {
    const r = 150 * (0.85 + 0.15 * Math.sin(time * 18));
    g.strokeStyle = "rgba(255,240,120,0.9)";
    g.lineWidth = 3;
    g.beginPath();
    g.arc(leader.x, leader.y, r, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = "rgba(255,240,120,0.12)";
    g.fill();
  }

  // The captain: a round little astronaut with a glowing antenna.
  const x = leader.x, y = leader.y;
  g.fillStyle = "rgba(0,0,0,0.28)";
  g.beginPath();
  g.ellipse(x, y + 9, 11, 4.5, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#ff8f3d";
  g.beginPath();
  g.ellipse(x, y, 9, 10, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "rgba(210,240,255,0.85)";
  g.beginPath();
  g.arc(x, y - 9, 8, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#ffd9b8";
  g.beginPath();
  g.arc(x + Math.cos(leader.face) * 1.5, y - 9, 5, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = "#ddd";
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(x, y - 17);
  g.lineTo(x, y - 24);
  g.stroke();
  g.fillStyle = `hsl(${50 + Math.sin(time * 4) * 10} 100% 60%)`;
  g.beginPath();
  g.arc(x, y - 25, 3, 0, Math.PI * 2);
  g.fill();
}

export function render(g: CanvasRenderingContext2D, world: World, garden: HTMLCanvasElement, time: number, aimRange: number) {
  g.drawImage(garden, 0, 0, world.width, world.height);
  drawPuddles(g, world, time);
  drawOnion(g, world, time);

  type Drawable = { y: number; draw: () => void };
  const list: Drawable[] = [];
  for (const item of world.items) list.push({ y: item.y, draw: () => drawItem(g, item) });
  for (const s of world.sprouts) {
    if (s.state === "flight" && s.t < 0) continue;
    list.push({ y: s.y + (s.z > 0 ? 1000 : 0), draw: () => drawSprout(g, s, time, world) });
  }
  list.push({ y: world.leader.y, draw: () => drawLeader(g, world, time, aimRange) });
  list.sort((a, b) => a.y - b.y);
  for (const d of list) d.draw();

  g.textAlign = "center";
  g.textBaseline = "alphabetic";
  g.font = "800 15px ui-rounded, 'SF Pro Rounded', system-ui, sans-serif";
  for (const p of world.popups) {
    g.globalAlpha = Math.max(0, 1 - p.t / 1.6);
    g.lineWidth = 4;
    g.strokeStyle = "rgba(40,20,0,0.6)";
    g.strokeText(p.text, p.x, p.y);
    g.fillStyle = "#fff6c8";
    g.fillText(p.text, p.x, p.y);
  }
  g.globalAlpha = 1;
}
