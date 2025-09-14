import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./test/integration-setup.ts"],
    include: ["**/*.integration.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    exclude: ["node_modules", "dist", ".next", "e2e"],
    testTimeout: 30000, // Longer timeout for integration tests
    hookTimeout: 30000,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        "test/",
        "e2e/",
        "**/*.d.ts",
        "**/*.config.*",
        "**/generated/**",
        "apps/web/.next/**",
        "tooling/**",
      ],
    },
  },
  resolve: {
    alias: {
      "@repo/db": path.resolve(__dirname, "./packages/db/src"),
      "@repo/trpc": path.resolve(__dirname, "./packages/trpc/src"),
      "@repo/utils": path.resolve(__dirname, "./packages/utils/src"),
      "@repo/config": path.resolve(__dirname, "./packages/config/src"),
      "@/components/ui": path.resolve(__dirname, "./packages/ui/src"),
    },
  },
});
