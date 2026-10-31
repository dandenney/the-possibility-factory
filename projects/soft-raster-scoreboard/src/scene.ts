import { FIELD_WIDTH, type Game, type Play } from "./espn.ts";
import { crowdTexture, displayColor, Heatmap, paintField, X_MAX, X_MIN, Z_MAX, Z_MIN } from "./field.ts";
import { lookAt, multiply, perspective, rotationY, rotationZ, translation, type Mat4, type Vec3 } from "./math.ts";
import { box, disc, football, merge, plane, quad, shade } from "./meshes.ts";
import { Framebuffer, rgb, type Mesh, type Texture } from "./raster.ts";
import { attackDir, BALL_REST, flightFor, sampleFlight } from "./replay.ts";

export type CameraMode = "broadcast" | "blimp" | "endzone";

export interface FrameState {
  index: number;
  /** Progress through plays[index], 0..1. */
  t: number;
  camera: CameraMode;
  time: number;
}

const MID = FIELD_WIDTH / 2;
const GOLD: Vec3 = [1, 0.84, 0.2];

function goalPost(x: number): Mesh {
  const w = 0.12;
  const half = 3.08; // 18'6" between uprights
  return merge([
    box([x - w, 0, MID - w], [x + w, 3.33, MID + w], GOLD),
    box([x - w, 3.33 - w, MID - half], [x + w, 3.33 + w, MID + half], GOLD),
    box([x - w, 3.33, MID - half - w], [x + w, 11, MID - half + w], GOLD),
    box([x - w, 3.33, MID + half - w], [x + w, 11, MID + half + w], GOLD),
  ]);
}

function stands(): Mesh {
  const x0 = X_MIN - 6, x1 = X_MAX + 6;
  const front = Z_MIN - 1.5;
  return merge([
    box([x0, 0, front - 1], [x1, 1.2, front], [0.2, 0.32, 0.24]),
    quad([x0, 1.2, front - 1], [x1, 1.2, front - 1], [x1, 22, front - 26], [x0, 22, front - 26]),
    box([x0, 22, front - 30], [x1, 26, front - 26], [0.12, 0.12, 0.15]),
  ]);
}

export class Scene {
  readonly fb: Framebuffer;
  private image: ImageData;
  private fieldMesh = plane(X_MIN, X_MAX, Z_MIN, Z_MAX, 16, 8);
  private apron = plane(X_MIN - 40, X_MAX + 40, Z_MIN - 2, Z_MAX + 60, 6, 4, -0.02);
  private standsMesh = stands();
  private crowd = crowdTexture();
  private posts = merge([goalPost(-10), goalPost(110)]);
  private ball = football(1.5, 0.48);
  private shadow = disc(0.9);
  private lineMesh = plane(-0.18, 0.18, 0, FIELD_WIDTH, 1, 4, 0.03);
  private field?: { base: Texture; current: Texture; heat: Heatmap; key: string };
  private game?: Game;
  private focus: Vec3 = [50, 0, MID];
  private eye: Vec3 = [50, 30, MID + 60];

  constructor(
    private readonly ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
  ) {
    this.image = ctx.createImageData(width, height);
    this.fb = new Framebuffer(width, height, this.image.data.buffer as ArrayBuffer);
    this.apron.colors = new Float32Array((this.apron.positions.length / 3) * 3).fill(1);
  }

  setGame(game: Game) {
    const sameTeams = this.game && this.game.home.id === game.home.id && this.game.away.id === game.away.id;
    this.game = game;
    if (sameTeams && this.field) return;
    const base = paintField(game.home, game.away);
    const current: Texture = { width: base.width, height: base.height, data: new Uint32Array(base.data) };
    this.field = { base, current, heat: new Heatmap(base, displayColor(game.home), displayColor(game.away)), key: "" };
  }

  render(state: FrameState) {
    const { fb } = this;
    const game = this.game;
    fb.clear(rgb(10, 12, 20));
    fb.gradient([8, 10, 22], [36, 42, 64]);
    if (!game || !this.field) return this.present();
    const plays = game.plays;
    const index = Math.min(state.index, plays.length - 1);
    const play = plays[index];
    const revealed = play ? (state.t >= 1 ? index + 1 : index) : 0;

    const key = `${plays.length}:${revealed}`;
    if (this.field.key !== key) {
      this.field.heat.render(plays, revealed, this.field.current);
      this.field.key = key;
    }

    // Ball position for this frame, and the flight so far (for the trail).
    const prevLane = (i: number) => plays[i - 1]?.lane ?? MID;
    let ballPos: Vec3 = [50, BALL_REST, MID];
    let heading = 0;
    if (play) {
      const segs = flightFor(play, prevLane(index));
      const p = sampleFlight(segs, state.t);
      const q = sampleFlight(segs, Math.min(1, state.t + 0.02));
      ballPos = p;
      heading = Math.atan2(q[2] - p[2], q[0] - p[0]) || (attackDir(play) > 0 ? 0 : Math.PI);
    }

    const vp = this.camera(state.camera, ballPos, play);

    fb.drawMesh(this.apron, vp, { texture: this.grass });
    fb.drawMesh(this.standsMesh, vp, { texture: this.crowd });
    fb.drawMesh(this.fieldMesh, vp, { texture: this.field.current });

    // Line of scrimmage and line to gain, like the broadcast overlay.
    if (play && (play.kind === "rush" || play.kind === "pass")) {
      fb.drawMesh(this.tinted(this.lineMesh, [0.2, 0.5, 1]), multiply(vp, translation(play.startX, 0, 0)), { depthBias: 0.001 });
      const toGain = plays[index - 1]?.firstDownX;
      if (toGain != null) fb.drawMesh(this.tinted(this.lineMesh, [1, 0.85, 0.1]), multiply(vp, translation(toGain, 0, 0)), { depthBias: 0.001 });
    }

    fb.drawMesh(this.posts, vp);

    // Trail for the current drive.
    if (play) {
      const color = displayColor(play.offense === "away" ? game.away : game.home);
      const trail = rgb(color[0], color[1], color[2]);
      for (let i = index; i >= 0 && plays[i]!.drive === play.drive; i--) {
        const segs = flightFor(plays[i]!, prevLane(i));
        const end = i === index ? state.t : 1;
        const steps = 18;
        let last = sampleFlight(segs, 0);
        for (let k = 1; k <= steps; k++) {
          const next = sampleFlight(segs, (k / steps) * end);
          fb.drawLine(vp, last as [number, number, number], next as [number, number, number], trail, i === index ? 2 : 1);
          last = next;
        }
      }
    }

    // Ball and its shadow.
    fb.drawMesh(this.shadow, multiply(vp, translation(ballPos[0], 0.02, ballPos[2])), { multiply: true, depthBias: 0.002 });
    const pitch = play?.kind === "rush" ? 0 : Math.sin(state.t * Math.PI) * 0.5;
    const spin = state.time * 12;
    const rot = multiply(rotationY(-heading), rotationZ(pitch));
    this.colorBall(rot, spin);
    fb.drawMesh(this.ball, multiply(vp, multiply(translation(ballPos[0], ballPos[1], ballPos[2]), rot)));

    this.present();
  }

  private grass: Texture = (() => {
    const data = new Uint32Array(64 * 64);
    for (let i = 0; i < data.length; i++) data[i] = rgb(22 + (i * 7) % 5, 52 + (i * 13) % 7, 28);
    return { width: 64, height: 64, data };
  })();

  private tinted(mesh: Mesh, c: Vec3): Mesh {
    const n = mesh.positions.length / 3;
    const colors = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) colors.set(c, i * 3);
    return { ...mesh, colors };
  }

  private colorBall(rot: Mat4, spin: number) {
    const { normals, colors } = this.ball;
    const cs = Math.cos(spin), sn = Math.sin(spin);
    for (let i = 0; i < normals.length; i += 3) {
      // Spin around the ball's long axis, then apply heading/pitch.
      const nx = normals[i]!, ny = normals[i + 1]! * cs - normals[i + 2]! * sn, nz = normals[i + 1]! * sn + normals[i + 2]! * cs;
      const n: Vec3 = [
        rot[0]! * nx + rot[4]! * ny + rot[8]! * nz,
        rot[1]! * nx + rot[5]! * ny + rot[9]! * nz,
        rot[2]! * nx + rot[6]! * ny + rot[10]! * nz,
      ];
      const vertex = i / 3;
      const ring = Math.floor(vertex / 11), seg = vertex % 11;
      const lace = (seg === 0 || seg === 10) && ring >= 3 && ring <= 5;
      const base: Vec3 = lace ? [1, 1, 1] : [0.55, 0.27, 0.12];
      const c = shade(n, base, 0.35);
      colors[i] = c[0]; colors[i + 1] = c[1]; colors[i + 2] = c[2];
    }
  }

  private camera(mode: CameraMode, ball: Vec3, play: Play | undefined): Mat4 {
    const aspect = this.fb.width / this.fb.height;
    let eye: Vec3;
    let target: Vec3;
    let fov = 0.62;
    if (mode === "blimp") {
      eye = [50, 74, MID + 62];
      target = [50, 0, MID - 2];
      fov = 0.78;
    } else if (mode === "endzone" && play) {
      const dir = attackDir(play);
      eye = [ball[0] - dir * 22, 9, MID + (ball[2] - MID) * 0.4];
      target = [ball[0] + dir * 12, 1, ball[2]];
      fov = 0.9;
    } else {
      const fx = Math.min(78, Math.max(22, ball[0]));
      eye = [fx, 30, MID + 50];
      target = [fx, 0, MID - 4];
    }
    // Ease toward the target camera so cuts feel like a camera operator, not a teleport.
    const k = 0.08;
    this.eye = this.eye.map((v, i) => v + (eye[i]! - v) * k) as Vec3;
    this.focus = this.focus.map((v, i) => v + (target[i]! - v) * k) as Vec3;
    return multiply(perspective(fov, aspect, 0.5, 600), lookAt(this.eye, this.focus));
  }

  private present() {
    this.ctx.putImageData(this.image, 0, 0);
  }
}
