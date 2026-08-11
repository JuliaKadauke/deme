import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { validateContentDir, validateEntityShape } from "./validator.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(here, "..", "test", "fixtures");

describe("validateEntityShape", () => {
  it("accepts a minimal valid room", () => {
    const result = validateEntityShape({
      id: "kitchen",
      type: "room",
      name: "Kitchen",
      hotspots: [],
    });
    expect(result).toEqual([]);
  });

  it("rejects an entity missing required fields", () => {
    const result = validateEntityShape({ id: "kitchen", type: "room" });
    expect(result.length).toBeGreaterThan(0);
    expect(result).toContainEqual(
      expect.objectContaining({ path: "/", message: expect.stringContaining("hotspots") }),
    );
  });

  it("rejects an id that does not match the allowed pattern", () => {
    const result = validateEntityShape({ id: "Not Valid!", type: "room", name: "x", hotspots: [] });
    expect(result.some((i) => i.path === "/id")).toBe(true);
  });

  it("rejects an unknown entity type", () => {
    const result = validateEntityShape({ id: "x", type: "vehicle" });
    expect(result).toEqual([
      expect.objectContaining({
        path: "/type",
        message: expect.stringContaining("unknown entity type"),
      }),
    ]);
  });

  it("rejects a scriptRef with neither scriptId nor source", () => {
    const result = validateEntityShape({
      id: "x",
      type: "item",
      name: "X",
      interactions: [{ hook: "on-look" }],
    });
    expect(result.some((i) => i.path === "/interactions/0")).toBe(true);
  });

  it("rejects a scriptRef with both scriptId and source", () => {
    const result = validateEntityShape({
      id: "x",
      type: "item",
      name: "X",
      interactions: [{ hook: "on-look", scriptId: "a", source: "b" }],
    });
    expect(result.some((i) => i.path === "/interactions/0")).toBe(true);
  });

  it("catches an in-file broken reference (dialogue rootNodeId)", () => {
    const result = validateEntityShape({
      id: "tree",
      type: "dialogueTree",
      rootNodeId: "missing",
      nodes: [{ id: "a", speaker: "npc", text: "hi" }],
    });
    expect(result).toEqual([expect.objectContaining({ path: "/rootNodeId", actual: '"missing"' })]);
  });
});

describe("validateContentDir", () => {
  it("passes the worked-example valid fixture (room + item + npc + dialogue tree + script)", () => {
    const report = validateContentDir(path.join(fixturesDir, "valid"));
    expect(report.issues).toEqual([]);
    expect(report.valid).toBe(true);
    expect(report.filesChecked).toBe(5);
  });

  it("catches malformed per-file schema errors", () => {
    const report = validateContentDir(path.join(fixturesDir, "malformed"));
    expect(report.valid).toBe(false);
    const paths = report.issues.map((i) => i.path);
    expect(paths).toContain("/id");
    expect(paths).toContain("/name");
    expect(paths).toContain("/");
  });

  it("catches referentially-broken content across and within files", () => {
    const report = validateContentDir(path.join(fixturesDir, "broken-refs"));
    expect(report.valid).toBe(false);
    const byPath = Object.fromEntries(report.issues.map((i) => [i.path, i]));

    expect(byPath["/hotspots/0/targetItemId"]).toMatchObject({ actual: '"missing-item"' });
    expect(byPath["/hotspots/0/interactions/0/scriptId"]).toMatchObject({
      actual: '"missing-script"',
    });
    expect(byPath["/npcIds/0"]).toMatchObject({ actual: '"missing-npc"' });
    expect(byPath["/exits/0/hotspotId"]).toMatchObject({ actual: '"not-a-hotspot"' });
  });
});
