import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Link previews need absolute URLs. This is where production lives; a
// deployment elsewhere sets VITE_SITE_URL, and index.html reads it as
// %VITE_SITE_URL%.
process.env.VITE_SITE_URL ||=
  "https://mykoladotsenko.github.io/foli-live-departures/";

function normalizedBasePath() {
  const value = String(process.env.VITE_BASE_PATH || "/").trim();
  const withLeadingSlash = value.startsWith("/") ? value : `/${value}`;
  return withLeadingSlash.endsWith("/") ? withLeadingSlash : `${withLeadingSlash}/`;
}

export default defineConfig({
  base: normalizedBasePath(),
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
        statements: 82,
        branches: 75,
        functions: 85,
        lines: 86,
      },
    },
  },
});
