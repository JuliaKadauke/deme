import { describe, expect, it } from "vitest";
import { resolvePlayIframeSrc } from "./host.js";

describe("resolvePlayIframeSrc", () => {
  it("leaves the iframe src untouched with no page query string", () => {
    expect(resolvePlayIframeSrc("/play.html", "")).toBe("/play.html");
  });

  it("forwards the page's query string onto the iframe src", () => {
    expect(resolvePlayIframeSrc("/play.html", "?debug")).toBe("/play.html?debug");
    expect(resolvePlayIframeSrc("/play.html", "?debug=1")).toBe("/play.html?debug=1");
  });

  it("replaces rather than appends if the iframe src already had a query string", () => {
    expect(resolvePlayIframeSrc("/play.html?stale=1", "?debug")).toBe("/play.html?debug");
  });
});
