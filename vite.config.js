import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

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
  },
});
