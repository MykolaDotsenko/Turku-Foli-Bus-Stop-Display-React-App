import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({ fetchStopMonitor: vi.fn() }));

vi.mock("../api/foliApi", () => ({
  fetchStopMonitor: mocks.fetchStopMonitor,
}));

import useRideProviderPoll from "./useRideProviderPoll";

const session = {
  id: "ride-1",
  lineRef: "1",
  tripRef: "trip-1",
  targetStop: { id: "32", name: "Puistokatu" },
  previousStop: { id: "164", name: "Kauppatori" },
};

function okResponse() {
  return {
    stopName: "Puistokatu",
    serverTime: 1_000,
    arrivals: [{ lineref: "1", tripref: "trip-1", recordedattime: 990 }],
  };
}

function harness(overrides = {}) {
  return {
    rideId: "ride-1",
    sessionRef: { current: session },
    runtimeRef: { current: {} },
    rideIdentity: () => ({ tripRef: "trip-1" }),
    readArrivalSignals: () => ({}),
    onRuntime: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  // The backoff adds jitter from Math.random so a city's phones do not retry
  // in lockstep. Counting rounds in a fixed window is only meaningful with
  // that pinned: otherwise an unlucky draw fails a correct implementation.
  vi.spyOn(Math, "random").mockReturnValue(0.5);
  mocks.fetchStopMonitor.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// A throw used to leave nothing scheduled, so live tracking ended for the
// rest of the ride with only the clock tick keeping the schedule fallback
// moving — and nothing on screen to say it had happened.
test("keeps polling after applying a result throws", async () => {
  mocks.fetchStopMonitor.mockResolvedValue(okResponse());

  const onRuntime = vi.fn(() => {
    throw new Error("state update blew up");
  });
  const props = harness({ onRuntime });

  const { unmount } = renderHook(() => useRideProviderPoll(props));

  await vi.advanceTimersByTimeAsync(0);
  expect(onRuntime).toHaveBeenCalledTimes(1);
  const afterFirst = mocks.fetchStopMonitor.mock.calls.length;

  await vi.advanceTimersByTimeAsync(21_000);
  expect(mocks.fetchStopMonitor.mock.calls.length).toBeGreaterThan(afterFirst);
  expect(onRuntime).toHaveBeenCalledTimes(2);

  unmount();
});

test("slows down while the provider is failing and speeds back up after it answers", async () => {
  mocks.fetchStopMonitor.mockRejectedValue(new Error("provider down"));
  const props = harness();

  const { unmount } = renderHook(() => useRideProviderPoll(props));

  // Gaps grow 20s, 40s, 80s, 80s…, so polls land at 0, 20, 60 and 140
  // seconds: four rounds where a flat 20s cadence would have made ten.
  await vi.advanceTimersByTimeAsync(200_000);
  const failingRounds = mocks.fetchStopMonitor.mock.calls.length / 2;
  expect(failingRounds).toBe(4);

  // One success resets the cadence, so the next 100s is back to 20s steps.
  mocks.fetchStopMonitor.mockResolvedValue(okResponse());
  await vi.advanceTimersByTimeAsync(100_000);
  const recoveredRounds =
    mocks.fetchStopMonitor.mock.calls.length / 2 - failingRounds;
  expect(recoveredRounds).toBeGreaterThanOrEqual(4);

  unmount();
});

test("stops polling once the ride ends", async () => {
  mocks.fetchStopMonitor.mockResolvedValue(okResponse());
  const props = harness();

  const { unmount } = renderHook(() => useRideProviderPoll(props));
  await vi.advanceTimersByTimeAsync(0);
  unmount();

  const afterUnmount = mocks.fetchStopMonitor.mock.calls.length;
  await vi.advanceTimersByTimeAsync(120_000);
  expect(mocks.fetchStopMonitor.mock.calls.length).toBe(afterUnmount);
});
