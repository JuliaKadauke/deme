import { expect, test } from "@playwright/test";

/**
 * Regression test for the ?debug forwarding bug: index.html embeds
 * play.html in an iframe with a static `src` attribute (see
 * src/host.ts / README.md), so the top-level page's query string — the
 * only mechanism for opting into the hotspot debug overlay (see
 * RoomSceneOptions.showHotspotDebug) — doesn't reach play.html unless
 * something forwards it. jsdom (used by the rest of this app's vitest
 * suite) can't observe this, since it never actually navigates a nested
 * iframe document the way a real browser does — same gap
 * e2e/play-sandbox.spec.ts exists to close for the CSP bug.
 */
test("?debug on index.html forwards onto play.html's iframe src", async ({ page }) => {
  await page.goto("/index.html?debug");
  await expect(page.locator("iframe")).toHaveAttribute("src", "/play.html?debug");
});

test("with no query string, play.html's iframe src is untouched", async ({ page }) => {
  await page.goto("/index.html");
  await expect(page.locator("iframe")).toHaveAttribute("src", "/play.html");
});
