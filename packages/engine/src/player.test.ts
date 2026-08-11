import { describe, expect, it } from "vitest";
import { Player } from "./player.js";

const WALK_BOX: [number, number][] = [
  [0, 0],
  [100, 0],
  [100, 100],
  [0, 100],
];

describe("Player", () => {
  it("stays put until commanded to walk", () => {
    const player = new Player({ x: 10, y: 10 });
    player.update(1000);
    expect(player.position).toEqual({ x: 10, y: 10 });
    expect(player.isWalking).toBe(false);
  });

  it("walks toward a target inside the walk box over time", () => {
    const player = new Player({ x: 0, y: 0 }, { speedPxPerSec: 100, walkBox: WALK_BOX });
    player.walkTo({ x: 100, y: 0 });
    expect(player.isWalking).toBe(true);

    player.update(500); // half a second at 100px/s => 50px
    expect(player.x).toBeCloseTo(50);
    expect(player.y).toBeCloseTo(0);
    expect(player.isWalking).toBe(true);

    player.update(500); // arrives
    expect(player.x).toBeCloseTo(100);
    expect(player.isWalking).toBe(false);
  });

  it("does not overshoot the target on a large time step", () => {
    const player = new Player({ x: 0, y: 0 }, { speedPxPerSec: 100, walkBox: WALK_BOX });
    player.walkTo({ x: 30, y: 40 });
    player.update(10_000);
    expect(player.position).toEqual({ x: 30, y: 40 });
    expect(player.isWalking).toBe(false);
  });

  it("clamps a click-to-walk target outside the walk box to its nearest edge", () => {
    const player = new Player({ x: 50, y: 50 }, { speedPxPerSec: 100, walkBox: WALK_BOX });
    const target = player.walkTo({ x: 200, y: 50 });
    expect(target).toEqual({ x: 100, y: 50 });

    player.update(10_000);
    expect(player.position).toEqual({ x: 100, y: 50 });
  });

  it("never leaves the walk box while walking toward a clamped target", () => {
    const player = new Player({ x: 50, y: 50 }, { speedPxPerSec: 40, walkBox: WALK_BOX });
    player.walkTo({ x: 500, y: -500 });

    for (let i = 0; i < 100; i++) {
      player.update(16);
      expect(player.x).toBeGreaterThanOrEqual(0);
      expect(player.x).toBeLessThanOrEqual(100);
      expect(player.y).toBeGreaterThanOrEqual(0);
      expect(player.y).toBeLessThanOrEqual(100);
    }
  });

  it("stop() cancels the current walk", () => {
    const player = new Player({ x: 0, y: 0 }, { speedPxPerSec: 100 });
    player.walkTo({ x: 100, y: 0 });
    player.update(250);
    player.stop();
    const positionAfterStop = player.position;
    player.update(1000);
    expect(player.position).toEqual(positionAfterStop);
    expect(player.isWalking).toBe(false);
  });
});
