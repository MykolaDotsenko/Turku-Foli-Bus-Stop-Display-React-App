import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const distDir = path.resolve("dist");
const assetsDir = path.join(distDir, "assets");
const sw = await readFile(path.join(distDir, "sw.js"), "utf8");
const assets = await readdir(assetsDir);

if (!sw.includes('const PRECACHE_URLS = [')) {
  throw new Error("Generated service worker has no precache manifest.");
}

if (!sw.includes('"/"')) {
  throw new Error("Generated service worker does not precache the app shell.");
}

for (const asset of assets) {
  if (!sw.includes(`/assets/${asset}`)) {
    throw new Error(`Generated service worker does not precache ${asset}.`);
  }
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
