import { describe, expect, it } from "vitest";
import { createEngine, ENGINE_VERSION } from "./index.js";

describe("createEngine", () => {
  it("returns the current engine version", () => {
    expect(createEngine()).toEqual({ version: ENGINE_VERSION });
  });
});
