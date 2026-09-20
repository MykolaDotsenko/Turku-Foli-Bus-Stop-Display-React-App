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
