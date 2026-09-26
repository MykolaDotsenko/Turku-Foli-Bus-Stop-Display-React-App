import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import useOnlineStatus from "./useOnlineStatus";

const originalOnLine = Object.getOwnPropertyDescriptor(navigator, "onLine");
const originalFetch = globalThis.fetch;
const originalCaches = Object.getOwnPropertyDescriptor(globalThis, "caches");

function setOnline(value) {
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    value,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  globalThis.localStorage.clear();

  if (originalOnLine) {
    Object.defineProperty(navigator, "onLine", originalOnLine);
  } else {
    delete navigator.onLine;
  }

  globalThis.fetch = originalFetch;

  if (originalCaches) {
    Object.defineProperty(globalThis, "caches", originalCaches);
  } else {
    delete globalThis.caches;
  }

  localStorage.clear();
});

test("reacts immediately to an explicit browser offline event", async () => {
  setOnline(true);
  globalThis.fetch = vi.fn().mockResolvedValue({ ok: true });

  const { result } = renderHook(() => useOnlineStatus());
  await waitFor(() => expect(result.current).toBe(true));

  act(() => {
    setOnline(false);
    window.dispatchEvent(new globalThis.Event("offline"));
  });

  expect(result.current).toBe(false);
});

test("does not trust an online hint when the app origin is unreachable", async () => {
  setOnline(true);
  globalThis.fetch = vi.fn().mockRejectedValue(new Error("network unavailable"));

  const { result } = renderHook(() => useOnlineStatus());

  await waitFor(() => expect(result.current).toBe(false));
  expect(globalThis.fetch).toHaveBeenCalledWith(
    new globalThis.URL(
      "/__foli_connectivity_probe__",
      window.location.href
    ).toString(),
    expect.objectContaining({
      method: "HEAD",
      cache: "no-store",
    })
  );
});

test("resynchronizes when a restored page becomes reachable again", async () => {
  setOnline(true);
  const fetchMock = vi
    .fn()
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValue({ ok: true });
  globalThis.fetch = fetchMock;

  const { result } = renderHook(() => useOnlineStatus());
  await waitFor(() => expect(result.current).toBe(false));

  act(() => {
    window.dispatchEvent(new globalThis.Event("pageshow"));
  });

  await waitFor(() => expect(result.current).toBe(true));
});


test("keeps explicit offline state across a PWA-style reload until reachability returns", async () => {
  setOnline(false);
  globalThis.fetch = vi.fn().mockRejectedValue(new Error("offline"));

  const first = renderHook(() => useOnlineStatus());

  act(() => {
    window.dispatchEvent(new globalThis.Event("offline"));
  });

  expect(first.result.current).toBe(false);
  expect(globalThis.localStorage.getItem("foli-offline-hint")).toBe("1");
  first.unmount();

  // Chromium can briefly report navigator.onLine=true when reopening from
  // the service-worker shell. The persisted hint keeps the degraded UI honest
  // until the uncached origin probe succeeds.
  setOnline(true);

  const second = renderHook(() => useOnlineStatus());
  expect(second.result.current).toBe(false);

  await waitFor(() => expect(second.result.current).toBe(false));
  expect(globalThis.localStorage.getItem("foli-offline-hint")).toBe("1");
});


test("persists an offline hint during reload even if the offline event was missed", () => {
  setOnline(true);
  globalThis.fetch = vi.fn().mockResolvedValue({ ok: true });

  const { unmount } = renderHook(() => useOnlineStatus());

  setOnline(false);
  act(() => {
    window.dispatchEvent(new globalThis.Event("beforeunload"));
  });

  expect(globalThis.localStorage.getItem("foli-offline-hint")).toBe("1");
  unmount();
});



test("persists an offline hint on pagehide before a PWA-style reload", async () => {
  setOnline(true);
  globalThis.fetch = vi.fn().mockResolvedValue({ ok: true });

  const { result, unmount } = renderHook(() => useOnlineStatus());
  await waitFor(() => expect(result.current).toBe(true));

  setOnline(false);
  act(() => {
    window.dispatchEvent(new globalThis.Event("pagehide"));
  });

  expect(globalThis.localStorage.getItem("foli-offline-hint")).toBe("1");
  unmount();
});


test("keeps the app in degraded mode when the service worker served the shell offline", async () => {
  setOnline(true);
  localStorage.setItem("foli-offline-hint", "1");

  const match = vi.fn().mockResolvedValue(new globalThis.Response("offline"));
  const keys = vi.fn().mockResolvedValue([]);
  Object.defineProperty(globalThis, "caches", {
    configurable: true,
    value: { match, keys },
  });

  globalThis.fetch = vi.fn().mockResolvedValue({ ok: true });

  const { result } = renderHook(() => useOnlineStatus());

  await waitFor(() => expect(result.current).toBe(false));
  expect(match).toHaveBeenCalledWith("/__foli_offline_shell__");
  expect(globalThis.fetch).not.toHaveBeenCalled();
});

// The service worker files the marker under the deployment's base path. Read
// at the origin root it never matched on GitHub Pages, where the app lives
// under /foli-live-departures/, so an offline reopen went unnoticed.
test("looks for the offline-shell marker under the deployment base path", async () => {
  vi.stubEnv("BASE_URL", "/foli-live-departures/");
  setOnline(true);

  const match = vi.fn().mockResolvedValue(new globalThis.Response("offline"));
  const keys = vi.fn().mockResolvedValue([]);
  Object.defineProperty(globalThis, "caches", {
    configurable: true,
    value: { match, keys },
  });
  globalThis.fetch = vi.fn().mockResolvedValue({ ok: true });

  const { result } = renderHook(() => useOnlineStatus());

  await waitFor(() => expect(result.current).toBe(false));
  expect(match).toHaveBeenCalledWith(
    "/foli-live-departures/__foli_offline_shell__"
  );
  expect(globalThis.fetch).not.toHaveBeenCalled();
});

test("clears the marker under the deployment base path once the origin answers", async () => {
  vi.stubEnv("BASE_URL", "/foli-live-departures/");
  setOnline(true);

  const deleteEntry = vi.fn().mockResolvedValue(true);
  Object.defineProperty(globalThis, "caches", {
    configurable: true,
    value: {
      match: vi.fn().mockResolvedValue(undefined),
      keys: vi.fn().mockResolvedValue(["foli-shell-abc"]),
      open: vi.fn().mockResolvedValue({ delete: deleteEntry }),
    },
  });
  globalThis.fetch = vi.fn().mockResolvedValue({ ok: true });

  const { result } = renderHook(() => useOnlineStatus());

  await waitFor(() => expect(deleteEntry).toHaveBeenCalled());
  expect(result.current).toBe(true);
  expect(deleteEntry).toHaveBeenCalledWith(
    "/foli-live-departures/__foli_offline_shell__"
  );
});

// Chrome throws on the very read of window.localStorage when a person has
// blocked site data, and the hook runs at the top of the app, so an unguarded
// read took the whole page down to the error screen.
test("keeps working when the browser refuses access to storage", async () => {
  const storage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    get() {
      throw new globalThis.DOMException(
        "Access is denied for this document.",
        "SecurityError"
      );
    },
  });

  try {
    setOnline(true);
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true });

    const { result } = renderHook(() => useOnlineStatus());
    await waitFor(() => expect(result.current).toBe(true));

    act(() => {
      setOnline(false);
      window.dispatchEvent(new globalThis.Event("offline"));
    });
    expect(result.current).toBe(false);
  } finally {
    if (storage) {
      Object.defineProperty(globalThis, "localStorage", storage);
    } else {
      delete globalThis.localStorage;
    }
  }
});
