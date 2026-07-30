import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@main": resolve("src/main"),
      "@renderer": resolve("src/renderer/src"),
      "@shared": resolve("src/shared")
    }
  },
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    environment: "node",
    exclude: ["tests/e2e/**", "node_modules/**", "out/**", "release/**"],
    coverage: {
      reporter: ["text", "html"]
    }
  }
});
