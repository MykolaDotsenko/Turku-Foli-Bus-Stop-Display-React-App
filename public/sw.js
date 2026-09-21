// Source fallback only.
// `npm run build` replaces dist/sw.js with a content-versioned service worker
// that precaches the complete production application shell.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// A get-off alert is shown by the service worker, so the tap that follows is
// delivered here and nowhere else. Without this the passenger taps "Get off
// now" on a locked phone and nothing opens: they still have to unlock, find
// the browser and find the tab, in the seconds the alert exists to save.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      for (const client of windows) {
        if (new URL(client.url).origin === self.location.origin) {
          await client.focus();
          return;
        }
      }

      await self.clients.openWindow("/");
    })()
  );
});

// A reload that commits while the first install is still running lands on a
// document this worker never claimed: activation, and the claim with it,
// already happened for a page that no longer exists. Nothing claims the new
// one, so that whole visit runs with no offline shell. The page notices and
// asks; claiming an already-activated worker's client is cheap and safe.
self.addEventListener("message", (event) => {
  if (event.data?.type === "foli-claim-clients") {
    event.waitUntil(self.clients.claim());
  }
});
