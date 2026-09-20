import { useEffect, useState } from "react";

const CONNECTIVITY_TIMEOUT_MS = 3000;

function browserSaysOnline() {
  return typeof navigator === "undefined" ? true : navigator.onLine !== false;
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
    // HEAD is deliberately not handled by the app's GET-only service worker.
    // A cached PWA shell therefore cannot make this network probe look online.
    await globalThis.fetch(
      new globalThis.URL("/", window.location.href).toString(),
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
  const [online, setOnline] = useState(browserSaysOnline);

  useEffect(() => {
    let active = true;
    let sequence = 0;

    const sync = async () => {
      const requestId = ++sequence;

      if (!browserSaysOnline()) {
        if (active && requestId === sequence) setOnline(false);
        return;
      }

      const reachable = await canReachAppOrigin();
      if (active && requestId === sequence) {
        setOnline(reachable);
      }
    };

    const markOffline = () => {
      sequence += 1;
      setOnline(false);
    };

    sync();

    window.addEventListener("online", sync);
    window.addEventListener("offline", markOffline);
    window.addEventListener("pageshow", sync);
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", sync);

    return () => {
      active = false;
      sequence += 1;
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", markOffline);
      window.removeEventListener("pageshow", sync);
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);

  return online;
}
