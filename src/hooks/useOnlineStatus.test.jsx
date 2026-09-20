import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import useOnlineStatus from "./useOnlineStatus";

const originalOnLine = Object.getOwnPropertyDescriptor(navigator, "onLine");
const originalFetch = globalThis.fetch;

function setOnline(value) {
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    value,
  });
}

afterEach(() => {
  vi.restoreAllMocks();

  if (originalOnLine) {
    Object.defineProperty(navigator, "onLine", originalOnLine);
  } else {
    delete navigator.onLine;
  }

  globalThis.fetch = originalFetch;
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
    new globalThis.URL("/", window.location.href).toString(),
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
