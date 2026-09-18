import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["**/__tests__/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text"],
      // Global project-wide gate (vitest exits non-zero on any missed
      // threshold; untested files count as 0% because coverage.all defaults to
      // true). Thresholds sit below the measured baseline (statements 85.5 /
      // branches 79.1 / functions 89.2 / lines 87, measured under Vitest 5 at
      // commit 9be3581) so CI holds the line and trends can only go up.
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80,
      },
    },
  },
});
