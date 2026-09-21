import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: "./src/setupTests.js",
    include: ["src/**/*.{test,spec}.{js,jsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "text"],
      include: ["src/**/*.{js,jsx}"],
      // Entry point and test scaffolding are not behaviour under test.
      exclude: ["src/**/*.{test,spec}.{js,jsx}", "src/setupTests.js", "src/main.jsx"],
      // Set just under what the suite currently reaches, so the numbers can
      // only be argued upwards. They are a ratchet, not a target.
      thresholds: {
        statements: 77,
        branches: 71,
        functions: 80,
        lines: 81,
      },
    },
  },
});
