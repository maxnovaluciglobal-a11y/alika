import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    testTimeout: 30_000,
    // Las pruebas comparten una base real: se ejecutan en serie con rollback por test.
    fileParallelism: false,
    sequence: { concurrent: false },
  },
});
