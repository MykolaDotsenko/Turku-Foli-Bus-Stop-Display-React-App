import { useEffect, useState } from "react";

const CONNECTIVITY_TIMEOUT_MS = 3000;
const OFFLINE_HINT_KEY = "foli-offline-hint";

// The service worker files the marker under the deployment's base path
// (scripts/build-sw.mjs). Looked up at the origin root it never matched on
// GitHub Pages, where the app lives under /foli-live-departures/.
function offlineShellMarkerUrl() {
  return `${import.meta.env.BASE_URL || "/"}__foli_offline_shell__`;
}

function browserSaysOnline() {
  return typeof navigator === "undefined" ? true : navigator.onLine !== false;
}

// Reading window.localStorage itself throws when a person has blocked site
// data, so even the existence check belongs inside the try. This hook runs at
// the top of the app: one uncaught read here was the whole page.
function readOfflineHint() {
  try {
    return globalThis.localStorage?.getItem(OFFLINE_HINT_KEY) === "1";
  } catch {
    return false;
  }
}

function writeOfflineHint(offline) {
  try {
    const storage = globalThis.localStorage;
    if (!storage) return;

    if (offline) {
      storage.setItem(OFFLINE_HINT_KEY, "1");
    } else {
      storage.removeItem(OFFLINE_HINT_KEY);
    }
  } catch {
    // Connectivity UI must not fail because storage is unavailable.
  }
}

async function shellWasServedOffline() {
  if (typeof globalThis.caches?.match !== "function") return false;

  try {
    return Boolean(await globalThis.caches.match(offlineShellMarkerUrl()));
  } catch {
    return false;
  }
}

async function clearOfflineShellMarker() {
  if (typeof globalThis.caches?.keys !== "function") return;

  try {
    const keys = await globalThis.caches.keys();
    await Promise.all(
      keys.map(async (key) => {
        const cache = await globalThis.caches.open(key);
        await cache.delete(offlineShellMarkerUrl());
      })
    );
  } catch {
    // Marker cleanup is best-effort. Connectivity checks still run normally.
  }
}

function initialOnlineState() {
  return browserSaysOnline() && !readOfflineHint();
}

async function canReachAppOrigin() {
  if (typeof window === "undefined" || typeof globalThis.fetch !== "function") {
    return browserSaysOnline();
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(
    () => controller.abort(),
    CONNECTIVITY_TIMEOUT_MS
  );

  try {
    await globalThis.fetch(
      new globalThis.URL(
        "/__foli_connectivity_probe__",
        window.location.href
      ).toString(),
      {
        method: "HEAD",
        cache: "no-store",
        signal: controller.signal,
      }
    );
    return true;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export default function useOnlineStatus() {
  const [online, setOnline] = useState(initialOnlineState);

  useEffect(() => {
    let active = true;
    let sequence = 0;

    const sync = async ({ ignoreOfflineShell = false } = {}) => {
      const requestId = ++sequence;

      if (!ignoreOfflineShell && (await shellWasServedOffline())) {
        writeOfflineHint(true);
        if (active && requestId === sequence) setOnline(false);
        return;
      }

      if (!browserSaysOnline()) {
        writeOfflineHint(true);
        if (active && requestId === sequence) setOnline(false);
        return;
      }

      const reachable = await canReachAppOrigin();
      if (active && requestId === sequence) {
        writeOfflineHint(!reachable);
        setOnline(reachable);

        if (reachable) {
          await clearOfflineShellMarker();
        }
      }
    };

    const markOffline = () => {
      sequence += 1;
      writeOfflineHint(true);
      setOnline(false);
    };

    const markOnline = () => {
      sync({ ignoreOfflineShell: true });
    };

    // The cache's offline marker describes how this page was opened, so it
    // decides the first check only. Later checks test the connection: with
    // Wi-Fi that had no internet, the browser never reports going offline,
    // no "online" event follows the recovery, and trusting the marker kept
    // "Offline mode" (and Get me Home switched off) for the whole visit.
    const recheck = () => {
      sync({ ignoreOfflineShell: true });
    };

    const persistOfflineBeforeReload = () => {
      if (!browserSaysOnline()) {
        writeOfflineHint(true);
      }
    };

    sync();

    window.addEventListener("online", markOnline);
    window.addEventListener("offline", markOffline);
    window.addEventListener("beforeunload", persistOfflineBeforeReload);
    window.addEventListener("pagehide", persistOfflineBeforeReload);
    window.addEventListener("pageshow", recheck);
    window.addEventListener("focus", recheck);
    document.addEventListener("visibilitychange", recheck);

    return () => {
      active = false;
      sequence += 1;
      window.removeEventListener("online", markOnline);
      window.removeEventListener("offline", markOffline);
      window.removeEventListener("beforeunload", persistOfflineBeforeReload);
      window.removeEventListener("pagehide", persistOfflineBeforeReload);
      window.removeEventListener("pageshow", recheck);
      window.removeEventListener("focus", recheck);
      document.removeEventListener("visibilitychange", recheck);
    };
  }, []);

  return online;
}
