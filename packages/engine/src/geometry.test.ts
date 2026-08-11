import { describe, expect, it } from "vitest";
import { clampToPolygon, hitTestArea, pointInPolygon, pointInRect } from "./geometry.js";

describe("pointInRect", () => {
  it("is true for a point inside the rect, including on its boundary", () => {
    const rect = { x: 10, y: 10, width: 20, height: 20 };
    expect(pointInRect({ x: 20, y: 20 }, rect)).toBe(true);
    expect(pointInRect({ x: 10, y: 10 }, rect)).toBe(true);
    expect(pointInRect({ x: 30, y: 30 }, rect)).toBe(true);
  });

  it("is false for a point outside the rect", () => {
    const rect = { x: 10, y: 10, width: 20, height: 20 };
    expect(pointInRect({ x: 5, y: 20 }, rect)).toBe(false);
    expect(pointInRect({ x: 31, y: 20 }, rect)).toBe(false);
  });
});

describe("pointInPolygon", () => {
  const square: [number, number][] = [
    [0, 0],
    [100, 0],
    [100, 100],
    [0, 100],
  ];

  it("is true for a point inside a simple polygon", () => {
    expect(pointInPolygon({ x: 50, y: 50 }, square)).toBe(true);
  });

  it("is false for a point outside a simple polygon", () => {
    expect(pointInPolygon({ x: 150, y: 50 }, square)).toBe(false);
  });

  it("handles a non-convex (L-shaped) polygon", () => {
    const lShape: [number, number][] = [
      [0, 0],
      [100, 0],
      [100, 50],
      [50, 50],
      [50, 100],
      [0, 100],
    ];
    expect(pointInPolygon({ x: 75, y: 75 }, lShape)).toBe(false);
    expect(pointInPolygon({ x: 25, y: 75 }, lShape)).toBe(true);
    expect(pointInPolygon({ x: 75, y: 25 }, lShape)).toBe(true);
  });
});

describe("hitTestArea", () => {
  it("dispatches to rect testing", () => {
    const area = { shape: "rect" as const, x: 0, y: 0, width: 10, height: 10 };
    expect(hitTestArea(area, { x: 5, y: 5 })).toBe(true);
    expect(hitTestArea(area, { x: 50, y: 5 })).toBe(false);
  });

  it("dispatches to polygon testing", () => {
    const area = {
      shape: "polygon" as const,
      points: [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
      ] as [number, number][],
    };
    expect(hitTestArea(area, { x: 5, y: 5 })).toBe(true);
    expect(hitTestArea(area, { x: 50, y: 5 })).toBe(false);
  });
});

describe("clampToPolygon", () => {
  const square: [number, number][] = [
    [0, 0],
    [100, 0],
    [100, 100],
    [0, 100],
  ];

  it("returns the point unchanged when already inside", () => {
    expect(clampToPolygon({ x: 50, y: 50 }, square)).toEqual({ x: 50, y: 50 });
  });

  it("clamps a point outside to the nearest edge", () => {
    const clamped = clampToPolygon({ x: 150, y: 50 }, square);
    expect(clamped).toEqual({ x: 100, y: 50 });
  });

  it("clamps a point outside near a corner to that corner", () => {
    const clamped = clampToPolygon({ x: 150, y: -50 }, square);
    expect(clamped).toEqual({ x: 100, y: 0 });
  });
});
