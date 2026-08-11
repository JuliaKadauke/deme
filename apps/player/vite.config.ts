import { defineConfig } from "vitest/config";

export default defineConfig({
  build: {
    outDir: "dist",
  },
  test: {
    environment: "jsdom",
    exclude: ["**/node_modules/**", "**/dist/**", "**/tsc-out/**"],
  },
});
