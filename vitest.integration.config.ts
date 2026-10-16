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
    env: loadEnv("", process.cwd(), ["TEST_", "NEXT_PUBLIC_", "GEMINI_"]),
    fileParallelism: false,
    // One module context for all files, so harness.ts can reuse signed-in accounts (Auth sign-in rate limits).
    isolate: false,
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
});
