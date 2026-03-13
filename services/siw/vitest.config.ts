import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    environment: "jsdom",
    exclude: ["tests/e2e/**", "node_modules/**"],
    environmentMatchGlobs: [
      ["tests/unit/**", "node"],
      ["tests/api/**", "node"],
      ["tests/ui/**", "jsdom"],
    ],
  },
});
