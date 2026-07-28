import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@renderer": resolve("src/renderer/src"),
      "@shared": resolve("src/shared")
    }
  },
  test: {
    environment: "node",
    exclude: ["tests/e2e/**", "node_modules/**", "out/**", "release/**"],
    coverage: {
      reporter: ["text", "html"]
    }
  }
});
