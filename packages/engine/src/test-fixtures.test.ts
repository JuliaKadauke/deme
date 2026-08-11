import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateContentDir, validateEntityShape } from "@deme/content-schema";
import { describe, expect, it } from "vitest";
import {
  loadFixtureDialogueTree,
  loadFixtureItem,
  loadFixtureNpc,
  loadFixtureRoom,
} from "./test-fixtures.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(here, "..", "test", "fixtures");

describe("fixture rooms", () => {
  it.each(["test-room", "test-room-2", "escape-room"])(
    "%s conforms to the content-schema Room schema",
    (name) => {
      const room = loadFixtureRoom(name);
      expect(validateEntityShape(room)).toEqual([]);
    },
  );
});

describe("escape-room content pack", () => {
  it("brass-key conforms to the content-schema Item schema", () => {
    expect(validateEntityShape(loadFixtureItem("brass-key"))).toEqual([]);
  });

  it.each(["jeeves", "aria"])("%s conforms to the content-schema Npc schema", (name) => {
    expect(validateEntityShape(loadFixtureNpc(name))).toEqual([]);
  });

  it.each(["jeeves-intro", "aria-intro"])(
    "%s conforms to the content-schema DialogueTree schema",
    (name) => {
      expect(validateEntityShape(loadFixtureDialogueTree(name))).toEqual([]);
    },
  );

  it("the whole test/fixtures directory is referentially valid content", () => {
    const report = validateContentDir(fixturesDir);
    expect(report.issues).toEqual([]);
    expect(report.valid).toBe(true);
  });
});
