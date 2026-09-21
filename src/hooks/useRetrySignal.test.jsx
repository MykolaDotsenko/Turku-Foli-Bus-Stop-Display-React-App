import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import useRetrySignal from "./useRetrySignal";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

test("retries a failed load only after its backoff has elapsed", () => {
  const { result } = renderHook(() => useRetrySignal());

  expect(result.current.attempt).toBe(0);

  act(() => result.current.reportFailure());
  act(() => vi.advanceTimersByTime(4_999));
  expect(result.current.attempt).toBe(0);

  act(() => vi.advanceTimersByTime(1));
  expect(result.current.attempt).toBe(1);
});

test("recovers immediately when connectivity returns, without a duplicate retry", () => {
  const { result } = renderHook(() => useRetrySignal());

  act(() => result.current.reportFailure());
  act(() => {
    window.dispatchEvent(new globalThis.Event("online"));
  });

  expect(result.current.attempt).toBe(1);

  act(() => vi.advanceTimersByTime(600_000));
  expect(result.current.attempt).toBe(1);
});

test("creates no provider load while hidden and catches up when the tab returns", () => {
  const visibility = vi
    .spyOn(document, "visibilityState", "get")
    .mockReturnValue("hidden");

  const { result } = renderHook(() => useRetrySignal());

  act(() => result.current.reportFailure());
  act(() => vi.advanceTimersByTime(600_000));
  expect(result.current.attempt).toBe(0);

  visibility.mockReturnValue("visible");
  act(() => {
    document.dispatchEvent(new globalThis.Event("visibilitychange"));
  });

  expect(result.current.attempt).toBe(1);
  visibility.mockRestore();
});

test("a successful load cancels the pending retry", () => {
  const { result } = renderHook(() => useRetrySignal());

  act(() => result.current.reportFailure());
  act(() => result.current.reportSuccess());
  act(() => vi.advanceTimersByTime(600_000));

  expect(result.current.attempt).toBe(0);
});

test("stops retrying once the consumer unmounts", () => {
  const { result, unmount } = renderHook(() => useRetrySignal());

  act(() => result.current.reportFailure());
  unmount();

  act(() => {
    window.dispatchEvent(new globalThis.Event("online"));
    vi.advanceTimersByTime(600_000);
  });

  expect(result.current.attempt).toBe(0);
});
