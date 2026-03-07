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
    exclude: ["**/node_modules/**", "**/tests/e2e/**"],
    environmentMatchGlobs: [
      ["tests/api/**", "node"],
      ["tests/ui/**", "jsdom"],
    ],
  },
});
