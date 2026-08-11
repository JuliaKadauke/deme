import { describe, expect, it } from "vitest";
import { validateEntity } from "./validator.js";

describe("validateEntity", () => {
  it("accepts a minimal valid entity", () => {
    const result = validateEntity({ id: "sample-room", type: "room" });
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("rejects an entity missing required fields", () => {
    const result = validateEntity({ id: "sample-room" });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("rejects an id that does not match the allowed pattern", () => {
    const result = validateEntity({ id: "Not Valid!", type: "room" });
    expect(result.valid).toBe(false);
  });
});
