import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import useOnlineStatus from "./useOnlineStatus";

const originalOnLine = Object.getOwnPropertyDescriptor(navigator, "onLine");

function setOnline(value) {
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    value,
  });
}

afterEach(() => {
  if (originalOnLine) {
    Object.defineProperty(navigator, "onLine", originalOnLine);
  } else {
    delete navigator.onLine;
  }
});

test("reacts to browser online and offline events using current browser state", () => {
  setOnline(true);

  const { result } = renderHook(() => useOnlineStatus());
  expect(result.current).toBe(true);

  act(() => {
    setOnline(false);
    window.dispatchEvent(new globalThis.Event("offline"));
  });
  expect(result.current).toBe(false);

  act(() => {
    setOnline(true);
    window.dispatchEvent(new globalThis.Event("online"));
  });
  expect(result.current).toBe(true);
});

test("resynchronizes connectivity after a restored page becomes visible", () => {
  setOnline(true);
  const { result } = renderHook(() => useOnlineStatus());

  act(() => {
    setOnline(false);
    window.dispatchEvent(new globalThis.Event("pageshow"));
  });

  expect(result.current).toBe(false);

  act(() => {
    setOnline(true);
    document.dispatchEvent(new globalThis.Event("visibilitychange"));
  });

  expect(result.current).toBe(true);
});
