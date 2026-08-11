import { describe, expect, it } from "vitest";
import { renderShell } from "./app.js";

describe("renderShell", () => {
  it("renders the engine version into the root element", () => {
    const root = document.createElement("div");
    renderShell(root);
    expect(root.textContent).toContain("engine v");
  });
});
