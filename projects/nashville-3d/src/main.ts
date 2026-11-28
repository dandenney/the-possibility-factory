import "./style.css";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MapControls } from "three/examples/jsm/controls/MapControls.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { LANDMARKS, LANDMARK_IDS, landmarkView, type Landmark } from "./landmarks.ts";
import { LIMITS, cameraFor, formatHash, normalizeView, parseHash, viewFrom, type View } from "./view.ts";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const stage = $("stage"), pinsEl = $("pins"), placesEl = $("places");
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const SKY = 0xe8ecef;

// ---------- scene ----------

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
stage.append(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(SKY);
scene.fog = new THREE.Fog(SKY, 1800, 4200);
scene.add(new THREE.HemisphereLight(0xf4f1ea, 0x6b6a62, 1.6));
const sun = new THREE.DirectionalLight(0xfff3df, 2.2);
sun.position.set(-600, 900, 400); // late-afternoon sun from the south-west
scene.add(sun);

const camera = new THREE.PerspectiveCamera(42, 1, 2, 9000);
const controls = new MapControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = LIMITS.minDist;
controls.maxDistance = LIMITS.maxDist;
controls.maxPolarAngle = THREE.MathUtils.degToRad(90 - LIMITS.minPitch);
controls.zoomToCursor = true;

const panel = $("panel");
const mobile = matchMedia("(max-width: 720px)");
/** The part of the screen the panel doesn't cover: the scene centres itself there. */
function openArea() {
  const w = innerWidth, h = innerHeight, r = panel.getBoundingClientRect();
  return mobile.matches ? { dx: 0, dy: r.height, w, h: h - r.height } : { dx: r.right, dy: 0, w: w - r.right, h };
}
function resize() {
  const w = innerWidth, h = innerHeight, a = openArea();
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.setViewOffset(w, h, -a.dx / 2, a.dy / 2, w, h);
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(panel);
addEventListener("resize", resize);
resize();

// ---------- ground heights (terrain + roofs) by ray from the sky ----------

let model: THREE.Object3D | null = null;
const ray = new THREE.Raycaster();
const DOWN = new THREE.Vector3(0, -1, 0);
function groundAt(x: number, z: number, roofs = false): number {
  if (!model) return 0;
  ray.set(new THREE.Vector3(x, 2000, z), DOWN);
  const targets = roofs ? [model] : model.children.filter((c) => c.name === "terrain");
  const hit = ray.intersectObjects(targets, true)[0];
  return hit ? hit.point.y : 0;
}

// ---------- camera moves ----------

let flight: { from: View; to: View; fromY: number; toY: number; t0: number; ms: number } | null = null;

function setView(v: View, y = groundAt(v.x, v.z)) {
  const c = cameraFor(v, y);
  camera.position.set(c.x, c.y, c.z);
  controls.target.set(v.x, y, v.z);
  controls.update();
}

function currentView(): View {
  return viewFrom(camera.position, controls.target);
}

function flyTo(to: View, ms = 2200) {
  const n = normalizeView(to);
  if (reduceMotion) { flight = null; setView(n); return; }
  const from = currentView();
  // turn the short way round
  const dh = ((n.heading - from.heading + 540) % 360) - 180;
  flight = { from, to: { ...n, heading: from.heading + dh }, fromY: controls.target.y, toY: groundAt(n.x, n.z), t0: performance.now(), ms };
}

const ease = (t: number) => 1 - Math.pow(1 - t, 3);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function stepFlight(now: number) {
  if (!flight) return;
  const t = Math.min(1, (now - flight.t0) / flight.ms), k = ease(t);
  const { from: a, to: b } = flight;
  // rise a little mid-flight on long hops so the city stays in frame
  const hop = Math.hypot(b.x - a.x, b.z - a.z);
  const lift = Math.sin(Math.PI * k) * Math.min(400, hop * 0.35);
  setView({
    x: lerp(a.x, b.x, k), z: lerp(a.z, b.z, k),
    dist: lerp(a.dist, b.dist, k) + lift,
    heading: lerp(a.heading, b.heading, k), pitch: lerp(a.pitch, b.pitch, k),
  }, lerp(flight.fromY, flight.toY, k));
  if (t >= 1) flight = null;
}

// ---------- landmarks: list, pins, "now showing" ----------

let current: Landmark | null = null;
/** true once the visitor drags away from the landmark they flew to */
let moved = false;
const pins = new Map<string, { el: HTMLButtonElement; pos: THREE.Vector3 }>();

for (const l of LANDMARKS) {
  const li = document.createElement("li");
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = l.name;
  b.dataset.id = l.id;
  b.addEventListener("click", () => { stopTour(); go(l); });
  li.append(b);
  placesEl.append(li);

  const pin = document.createElement("button");
  pin.type = "button";
  pin.className = "pin";
  pin.tabIndex = -1;
  pin.setAttribute("aria-hidden", "true");
  pin.innerHTML = `<span></span>`;
  pin.querySelector("span")!.textContent = l.name;
  pin.addEventListener("click", () => { stopTour(); go(l); });
  pinsEl.append(pin);
  pins.set(l.id, { el: pin, pos: new THREE.Vector3() });
}

function show(l: Landmark | null) {
  current = l;
  moved = false;
  $("now").hidden = !l;
  if (l) { $("nowName").textContent = l.name; $("nowNote").textContent = l.note; }
  for (const b of placesEl.querySelectorAll<HTMLButtonElement>("button")) {
    b.setAttribute("aria-current", String(b.dataset.id === l?.id));
    if (l && b.dataset.id === l.id) b.scrollIntoView({ block: "nearest", inline: "nearest", behavior: reduceMotion ? "auto" : "smooth" });
  }
  for (const [id, p] of pins) p.el.classList.toggle("on", id === l?.id);
}

/** A landmark's view, pulled back on tall narrow screens and raised until nothing blocks it. */
function frame(l: Landmark): View {
  const a = openArea();
  const v = landmarkView(l);
  const tall = a.h / a.w;
  v.dist *= Math.min(2.2, Math.max(1, 1.25 * tall));
  if (tall > 1.2) v.pitch += 12;
  if (!model) return v;
  const target = new THREE.Vector3(v.x, groundAt(v.x, v.z, true) + 8, v.z);
  for (; v.pitch < 75; v.pitch += 6) {
    const c = cameraFor(v, target.y - 8);
    const dir = new THREE.Vector3(c.x, c.y, c.z).sub(target);
    const len = dir.length();
    ray.set(target, dir.normalize());
    ray.far = len;
    const hit = ray.intersectObject(model, true).some((h) => h.distance > 25);
    ray.far = Infinity;
    if (!hit) break;
  }
  return v;
}

function go(l: Landmark, ms?: number) {
  show(l);
  flyTo(frame(l), ms);
  history.replaceState(null, "", `#${l.id}`);
}

const v3 = new THREE.Vector3();
function placePins() {
  const w = innerWidth, h = innerHeight;
  for (const [id, p] of pins) {
    v3.copy(p.pos).project(camera);
    const behind = v3.z > 1 || Math.abs(v3.x) > 1.2 || Math.abs(v3.y) > 1.2;
    p.el.classList.toggle("off", behind);
    if (behind) continue;
    const d = camera.position.distanceTo(p.pos);
    p.el.classList.toggle("far", d > 1500 && id !== current?.id);
    p.el.style.transform = `translate(${((v3.x + 1) / 2) * w - 5}px, ${((1 - v3.y) / 2) * h - 5}px)`;
  }
}

// ---------- tour ----------

let tourTimer = 0;
const tourBtn = $<HTMLButtonElement>("tour");
function stopTour() {
  clearTimeout(tourTimer);
  tourTimer = 0;
  tourBtn.setAttribute("aria-pressed", "false");
  tourBtn.textContent = "Take the tour";
}
function tourNext() {
  const i = current ? (LANDMARKS.indexOf(current) + 1) % LANDMARKS.length : 0;
  go(LANDMARKS[i]!, 3200);
  tourTimer = window.setTimeout(tourNext, 7500);
}
tourBtn.addEventListener("click", () => {
  if (tourTimer) return stopTour();
  tourBtn.setAttribute("aria-pressed", "true");
  tourBtn.textContent = "Stop the tour";
  tourNext();
});
// a drag or zoom takes over from the tour and any flight in progress
controls.addEventListener("start", () => {
  flight = null;
  moved = true;
  stopTour();
});

// ---------- share ----------

const toast = $("toast");
let toastTimer = 0;
function say(msg: string) {
  toast.textContent = msg;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (toast.hidden = true), 3500);
}

$("share").addEventListener("click", async () => {
  const v = currentView();
  const near = current && !moved && !flight;
  const url = `${location.origin}${location.pathname}${near ? `#${current!.id}` : formatHash(v)}`;
  history.replaceState(null, "", url);
  const title = current && near ? `${current.name}, in 3D` : "Nashville in 3D";
  try {
    if (navigator.share && matchMedia("(pointer: coarse)").matches) {
      await navigator.share({ title, url });
      return;
    }
    await navigator.clipboard.writeText(url);
    say("Link copied. It opens on this exact view.");
  } catch (e) {
    if ((e as Error).name !== "AbortError") say(url);
  }
});

function routeFromHash(animate: boolean) {
  const r = parseHash(location.hash, LANDMARK_IDS);
  if (r?.kind === "landmark") {
    const l = LANDMARKS.find((x) => x.id === r.id)!;
    show(l);
    if (animate) flyTo(frame(l)); else setView(frame(l));
    return true;
  }
  if (r?.kind === "view") {
    show(null);
    if (animate) flyTo(r.view); else setView(r.view);
    return true;
  }
  return false;
}
addEventListener("hashchange", () => routeFromHash(true));

// ---------- load ----------

const OVERVIEW: View = { x: 60, z: -60, dist: 1900, heading: 25, pitch: 42 };
setView(OVERVIEW);

function loop(now: number) {
  stepFlight(now);
  if (!flight) controls.update();
  renderer.render(scene, camera);
  placePins();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
const bar = $("loadingBar"), loadingText = $("loadingText"), loading = $("loading");
loader.load(
  "/nashville.glb",
  (gltf) => {
    model = gltf.scene;
    model.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) m.matrixAutoUpdate = false;
    });
    model.updateMatrixWorld(true);
    scene.add(model);
    for (const l of LANDMARKS) {
      const { x, z } = landmarkView(l);
      pins.get(l.id)!.pos.set(x, groundAt(x, z, true) + 4, z);
    }
    loading.classList.add("done");
    loading.setAttribute("aria-valuenow", "100");
    if (!routeFromHash(false)) {
      setView(OVERVIEW);
      flyTo({ ...OVERVIEW, dist: 1300, pitch: 36, heading: 15 }, 3000);
    }
  },
  (e) => {
    if (!e.total) { loadingText.textContent = `Loading downtown… ${(e.loaded / 1e6).toFixed(1)} MB`; return; }
    const pct = Math.round((e.loaded / e.total) * 100);
    bar.style.width = `${pct}%`;
    loading.setAttribute("aria-valuenow", String(pct));
    loadingText.textContent = `Loading downtown… ${(e.loaded / 1e6).toFixed(1)} of ${(e.total / 1e6).toFixed(1)} MB`;
  },
  (err) => {
    console.error(err);
    loadingText.textContent = "The model didn't load. Check your connection and reload the page.";
  },
);
