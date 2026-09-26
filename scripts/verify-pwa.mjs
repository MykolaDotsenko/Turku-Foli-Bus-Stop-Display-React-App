import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

// Normalized exactly as in vite.config.js and scripts/build-sw.mjs, so the
// gate checks the build it is given: "/" by default, and the GitHub Pages
// subpath that production actually ships under.
const configuredBasePath = String(process.env.VITE_BASE_PATH || "/").trim();
const baseWithLeadingSlash = configuredBasePath.startsWith("/")
  ? configuredBasePath
  : `/${configuredBasePath}`;
const BASE_PATH = baseWithLeadingSlash.endsWith("/")
  ? baseWithLeadingSlash
  : `${baseWithLeadingSlash}/`;

const distDir = path.resolve("dist");
const assetsDir = path.join(distDir, "assets");
const sw = await readFile(path.join(distDir, "sw.js"), "utf8");
const assets = await readdir(assetsDir);

if (!sw.includes('const PRECACHE_URLS = [')) {
  throw new Error("Generated service worker has no precache manifest.");
}

if (!sw.includes(JSON.stringify(BASE_PATH))) {
  throw new Error("Generated service worker does not precache the app shell.");
}

for (const asset of assets) {
  if (!sw.includes(`${BASE_PATH}assets/${asset}`)) {
    throw new Error(`Generated service worker does not precache ${asset}.`);
  }
}

// The page tells an offline reopen apart by looking for a marker the worker
// files when it serves the cached shell. The two only agree if both put it
// under the same base path.
const markerUrl = sw.match(/const OFFLINE_MARKER_URL = `([^`]+)`;/)?.[1];

if (!markerUrl?.startsWith(BASE_PATH)) {
  throw new Error(
    "Generated service worker does not file the offline-shell marker under the base path."
  );
}

const scripts = await Promise.all(
  assets
    .filter((asset) => asset.endsWith(".js"))
    .map((asset) => readFile(path.join(assetsDir, asset), "utf8"))
);

if (!scripts.some((source) => source.includes(markerUrl))) {
  throw new Error(
    `The app never looks for the offline-shell marker at ${markerUrl}, so an offline reopen goes unnoticed.`
  );
}


if (!sw.includes('caches.match(request, { ignoreVary: true })')) {
  throw new Error(
    "Generated service worker does not ignore Vary for same-origin precached assets."
  );
}

if (!sw.includes('caches.match(SHELL_URL, { ignoreVary: true })')) {
  throw new Error(
    "Generated service worker does not ignore Vary for the offline navigation shell."
  );
}

if (!sw.includes('self.addEventListener("notificationclick"')) {
  throw new Error(
    "Generated service worker does not handle notification taps, so a get-off alert cannot reopen the app."
  );
}

if (!sw.includes('foli-claim-clients')) {
  throw new Error(
    "Generated service worker cannot take over a page that reloaded during install, so that visit has no offline shell."
  );
}
