import { validateEntityShape } from "@deme/content-schema";
import { describe, expect, it } from "vitest";
import { loadFixtureRoom } from "./test-fixtures.js";

describe("fixture rooms", () => {
  it.each(["test-room", "test-room-2"])("%s conforms to the content-schema Room schema", (name) => {
    const room = loadFixtureRoom(name);
    expect(validateEntityShape(room)).toEqual([]);
  });
});
