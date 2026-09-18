import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.integration.test.ts"],
    setupFiles: ["./src/tests/integration/setup.ts"],
    fileParallelism: false,
    maxWorkers: 1,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
