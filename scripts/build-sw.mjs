import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const DIST_DIR = path.resolve("dist");
const SW_PATH = path.join(DIST_DIR, "sw.js");

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(fullPath)));
    } else {
      files.push(fullPath);
    }
  }

  return files;
}

const allFiles = (await listFiles(DIST_DIR))
  .filter((file) => file !== SW_PATH)
  .filter((file) => !file.endsWith(".map"))
  .sort();

const hash = createHash("sha256");
for (const file of allFiles) {
  const relative = path.relative(DIST_DIR, file).replaceAll(path.sep, "/");
  hash.update(relative);
  hash.update(await readFile(file));
}

const cacheName = `foli-shell-${hash.digest("hex").slice(0, 12)}`;
const precacheUrls = [
  "/",
  ...allFiles
    .map((file) => path.relative(DIST_DIR, file).replaceAll(path.sep, "/"))
    .filter((relative) => relative !== "index.html")
    .map((relative) => `/${relative}`),
];

const serviceWorker = `const CACHE_NAME = ${JSON.stringify(cacheName)};
const CACHE_PREFIX = "foli-shell-";
const SHELL_URL = "/";
const OFFLINE_MARKER_URL = "/__foli_offline_shell__";
const PRECACHE_URLS = ${JSON.stringify(precacheUrls, null, 2)};

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME
            )
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

async function markOfflineShell(offline) {
  const cache = await caches.open(CACHE_NAME);

  if (offline) {
    await cache.put(
      OFFLINE_MARKER_URL,
      new Response("offline", {
        headers: { "Content-Type": "text/plain" },
      })
    );
  } else {
    await cache.delete(OFFLINE_MARKER_URL);
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          await markOfflineShell(false);
          return response;
        } catch {
          await markOfflineShell(true);
          return caches.match(SHELL_URL, { ignoreVary: true });
        }
      })()
    );
    return;
  }

  event.respondWith(
    caches.match(request, { ignoreVary: true }).then((cached) => cached || fetch(request))
  );
});
`;

await writeFile(SW_PATH, serviceWorker, "utf8");
