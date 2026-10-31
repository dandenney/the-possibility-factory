import { describe, expect, it } from "vitest";
import { World } from "./sim.ts";
import { BUILTIN_TYPES } from "./types.ts";

const red = BUILTIN_TYPES.find((t) => t.id === "red")!;
const blue = BUILTIN_TYPES.find((t) => t.id === "blue")!;

function settle(world: World, seconds: number) {
  for (let t = 0; t < seconds; t += 1 / 30) world.update(1 / 30);
}

describe("World", () => {
  it("pops sprouts out of the onion and lets the leader pick them up", () => {
    const world = new World(1200, 800, 3);
    world.puddles = [];
    world.spawnSprouts(red, 10);
    settle(world, 2);
    expect(world.sprouts.every((s) => s.state !== "flight")).toBe(true);
    world.leader.whistling = true;
    world.leader.aimX = world.leader.x = world.onion.x;
    world.leader.aimY = world.leader.y = world.onion.y;
    settle(world, 0.2);
    expect(world.followers()).toHaveLength(10);
  });

  it("carries an item home once enough sprouts grab it, and the onion makes more", () => {
    const world = new World(1200, 800, 5);
    world.puddles = [];
    world.items = [{ id: 999, kind: "cookie", x: world.onion.x + 200, y: world.onion.y, r: 17, weight: 5, value: 6, color: "#c98a46", carriers: [], moving: false }];
    world.spawnSprouts(red, 5, false);
    for (const s of world.sprouts) { s.x = world.onion.x + 200; s.y = world.onion.y + 20; s.state = "charge"; }
    world.leader.aimX = world.onion.x + 200;
    world.leader.aimY = world.onion.y;
    settle(world, 0.5);
    expect(world.items[0]!.carriers.length).toBe(5);
    settle(world, 30);
    expect(world.delivered).toBe(1);
    expect(world.onion.pile).toBe(1);
    expect(world.sprouts.length).toBe(11);
  });

  it("only swimmers can grab an item that sits in a puddle", () => {
    const world = new World(1200, 800, 7);
    world.puddles = [{ x: 300, y: 300, rx: 80, ry: 50 }];
    world.items = [{ id: 1, kind: "berry", x: 300, y: 300, r: 10, weight: 2, value: 3, color: "#d6263b", carriers: [], moving: false }];
    world.leader.x = 300; world.leader.y = 380;
    world.leader.aimX = 300; world.leader.aimY = 300;
    world.spawnSprouts(red, 1, false);
    world.spawnSprouts(blue, 1, false);
    for (const s of world.sprouts) { s.x = 300; s.y = 380; s.state = "follow"; }
    world.throwOne("red");
    world.throwOne("blue");
    settle(world, 1);
    expect(world.items[0]!.carriers.map((c) => c.type.id)).toEqual(["blue"]);
    const redSprout = world.sprouts.find((s) => s.type.id === "red")!;
    expect(world.inPuddle(redSprout.x, redSprout.y)).toBeUndefined();
  });
});
