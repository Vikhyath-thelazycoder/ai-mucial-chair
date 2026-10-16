import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Integration tests run against the aimc-test cloud project only (D-013). Never point them at production.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["integration/**/*.test.ts"],
    env: loadEnv("", process.cwd(), ["TEST_", "NEXT_PUBLIC_"]),
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
});
