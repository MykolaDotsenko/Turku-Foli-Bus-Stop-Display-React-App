import { useEffect, useState } from "react";

const CONNECTIVITY_TIMEOUT_MS = 3000;
const OFFLINE_HINT_KEY = "foli-offline-hint";
const OFFLINE_SHELL_MARKER_URL = "/__foli_offline_shell__";

function browserSaysOnline() {
  return typeof navigator === "undefined" ? true : navigator.onLine !== false;
}

function readOfflineHint() {
  if (typeof globalThis.localStorage === "undefined") return false;

  try {
    return globalThis.localStorage.getItem(OFFLINE_HINT_KEY) === "1";
  } catch {
    return false;
  }
}

function writeOfflineHint(offline) {
  if (typeof globalThis.localStorage === "undefined") return;

  try {
    if (offline) {
      globalThis.localStorage.setItem(OFFLINE_HINT_KEY, "1");
    } else {
      globalThis.localStorage.removeItem(OFFLINE_HINT_KEY);
    }
  } catch {
    // Connectivity UI must not fail because storage is unavailable.
  }
}

async function shellWasServedOffline() {
  if (typeof globalThis.caches?.match !== "function") return false;

  try {
    return Boolean(await globalThis.caches.match(OFFLINE_SHELL_MARKER_URL));
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
        await cache.delete(OFFLINE_SHELL_MARKER_URL);
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
        method: "GET",
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
    window.addEventListener("pageshow", sync);
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", sync);

    return () => {
      active = false;
      sequence += 1;
      window.removeEventListener("online", markOnline);
      window.removeEventListener("offline", markOffline);
      window.removeEventListener("beforeunload", persistOfflineBeforeReload);
      window.removeEventListener("pagehide", persistOfflineBeforeReload);
      window.removeEventListener("pageshow", sync);
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);

  return online;
}
