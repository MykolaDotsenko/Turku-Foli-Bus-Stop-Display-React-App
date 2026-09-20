import { useEffect, useState } from "react";

const CONNECTIVITY_TIMEOUT_MS = 3000;
const OFFLINE_HINT_KEY = "foli-offline-hint";

function browserSaysOnline() {
  return typeof navigator === "undefined" ? true : navigator.onLine !== false;
}

function readOfflineHint() {
  if (typeof globalThis.sessionStorage === "undefined") return false;

  try {
    return globalThis.sessionStorage.getItem(OFFLINE_HINT_KEY) === "1";
  } catch {
    return false;
  }
}

function writeOfflineHint(offline) {
  if (typeof globalThis.sessionStorage === "undefined") return;

  try {
    if (offline) {
      globalThis.sessionStorage.setItem(OFFLINE_HINT_KEY, "1");
    } else {
      globalThis.sessionStorage.removeItem(OFFLINE_HINT_KEY);
    }
  } catch {
    // Connectivity UI must not fail because storage is unavailable.
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
    // This path is deliberately absent from the production precache. The
    // service worker can therefore only satisfy it by reaching the network.
    // A cached application shell cannot make this probe look online.
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

    const sync = async () => {
      const requestId = ++sequence;

      if (!browserSaysOnline()) {
        writeOfflineHint(true);
        if (active && requestId === sequence) setOnline(false);
        return;
      }

      const reachable = await canReachAppOrigin();
      if (active && requestId === sequence) {
        writeOfflineHint(!reachable);
        setOnline(reachable);
      }
    };

    const markOffline = () => {
      sequence += 1;
      writeOfflineHint(true);
      setOnline(false);
    };

    const persistOfflineBeforeReload = () => {
      if (!browserSaysOnline()) {
        writeOfflineHint(true);
      }
    };

    sync();

    window.addEventListener("online", sync);
    window.addEventListener("offline", markOffline);
    window.addEventListener("beforeunload", persistOfflineBeforeReload);
    window.addEventListener("pageshow", sync);
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", sync);

    return () => {
      active = false;
      sequence += 1;
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", markOffline);
      window.removeEventListener("beforeunload", persistOfflineBeforeReload);
      window.removeEventListener("pageshow", sync);
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);

  return online;
}
