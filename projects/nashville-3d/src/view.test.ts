import { describe, expect, it } from "vitest";
import { toLatLon, toLocal } from "./geo.ts";
import { LANDMARKS, LANDMARK_IDS, landmarkView } from "./landmarks.ts";
import { cameraFor, formatHash, parseHash, viewFrom } from "./view.ts";

describe("geo", () => {
  it("puts north at -Z and east at +X", () => {
    const p = toLocal(36.1635, -86.775);
    expect(p.z).toBeLessThan(0);
    expect(p.x).toBeGreaterThan(0);
  });
  it("round-trips", () => {
    const { x, z } = toLocal(36.1612, -86.7785);
    const back = toLatLon(x, z);
    expect(back.lat).toBeCloseTo(36.1612, 6);
    expect(back.lon).toBeCloseTo(-86.7785, 6);
  });
  it("keeps every landmark inside the 1 km model", () => {
    for (const l of LANDMARKS) {
      const { x, z } = toLocal(l.lat, l.lon);
      expect(Math.hypot(x, z), l.id).toBeLessThan(1000);
    }
  });
});

describe("views", () => {
  it("cameraFor and viewFrom invert each other", () => {
    const v = { x: 120, z: -340, dist: 300, heading: 75, pitch: 30 };
    const cam = cameraFor(v, 12);
    const back = viewFrom(cam, { x: v.x, y: 12, z: v.z });
    expect(back.dist).toBeCloseTo(300, 6);
    expect(back.heading).toBeCloseTo(75, 6);
    expect(back.pitch).toBeCloseTo(30, 6);
  });
  it("a north-facing camera sits south of its target", () => {
    const cam = cameraFor({ x: 0, z: 0, dist: 100, heading: 0, pitch: 0 }, 0);
    expect(cam.z).toBeCloseTo(100, 6);
    expect(cam.x).toBeCloseTo(0, 6);
  });
});

describe("hash", () => {
  it("reads landmark ids and ignores unknown ones", () => {
    expect(parseHash("#ryman", LANDMARK_IDS)).toEqual({ kind: "landmark", id: "ryman" });
    expect(parseHash("#nope", LANDMARK_IDS)).toBeNull();
    expect(parseHash("", LANDMARK_IDS)).toBeNull();
  });
  it("round-trips a shared view", () => {
    const v = landmarkView(LANDMARKS[1]!);
    const parsed = parseHash(formatHash(v), LANDMARK_IDS);
    expect(parsed?.kind).toBe("view");
    if (parsed?.kind !== "view") return;
    expect(parsed.view.x).toBeCloseTo(v.x, -0.5);
    expect(parsed.view.heading).toBe(v.heading);
  });
  it("clamps silly shared views", () => {
    const parsed = parseHash("#@99999,0,1,-30,120", LANDMARK_IDS);
    if (parsed?.kind !== "view") throw new Error("expected a view");
    expect(Math.hypot(parsed.view.x, parsed.view.z)).toBeLessThanOrEqual(1100.001);
    expect(parsed.view.dist).toBe(40);
    expect(parsed.view.heading).toBe(330);
    expect(parsed.view.pitch).toBe(89);
    expect(parseHash("#@1,2,3", LANDMARK_IDS)).toBeNull();
  });
});
