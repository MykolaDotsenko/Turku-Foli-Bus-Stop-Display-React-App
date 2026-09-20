import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import useOnlineStatus from "./useOnlineStatus";

const originalOnLine = Object.getOwnPropertyDescriptor(navigator, "onLine");

afterEach(() => {
  if (originalOnLine) {
    Object.defineProperty(navigator, "onLine", originalOnLine);
  } else {
    delete navigator.onLine;
  }
});

test("reacts to browser online and offline events", () => {
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    value: true,
  });

  const { result } = renderHook(() => useOnlineStatus());
  expect(result.current).toBe(true);

  act(() => {
    window.dispatchEvent(new Event("offline"));
  });
  expect(result.current).toBe(false);

  act(() => {
    window.dispatchEvent(new Event("online"));
  });
  expect(result.current).toBe(true);
});
