// Source fallback only.
// `npm run build` replaces dist/sw.js with a content-versioned service worker
// that precaches the complete production application shell.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
