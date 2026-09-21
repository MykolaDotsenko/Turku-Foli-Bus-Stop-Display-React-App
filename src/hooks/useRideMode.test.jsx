import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchStopMonitor: vi.fn(() => new Promise(() => {})),
  runRideTestAlert: vi.fn(() => Promise.resolve()),
  stopRideAlerts: vi.fn(),
  requestRideNotificationPermission: vi.fn(() => Promise.resolve(false)),
  announceRideStage: vi.fn(),
  repeatNowRideSignal: vi.fn(),
}));

vi.mock("../api/foliApi", () => ({
  fetchStopMonitor: mocks.fetchStopMonitor,
}));

vi.mock("../utils/rideAlerts", () => ({
  announceRideStage: mocks.announceRideStage,
  repeatNowRideSignal: mocks.repeatNowRideSignal,
  requestRideNotificationPermission: mocks.requestRideNotificationPermission,
  runRideTestAlert: mocks.runRideTestAlert,
  stopRideAlerts: mocks.stopRideAlerts,
}));

import useRideMode from "./useRideMode";

const rideConfig = {
  lineRef: "1",
  destination: "Satama",
  tripRef: "trip-1",
  datedVehicleJourneyRef: "journey-1",
  vehicleRef: "bus-1",
  originAimedDepartureTime: 1000,
  boardingStop: { id: "164", name: "Kauppatori" },
  targetStop: { id: "32", name: "Puistokatu", lat: 60.44, lon: 22.25 },
  previousStop: { id: "164", name: "Kauppatori" },
  nextStop: { id: "4", name: "Turun linna" },
  plan: {
    targetPredictedEpochSec: Math.floor(Date.now() / 1000) + 500,
    stopsToTarget: [
      {
        id: "32",
        name: "Puistokatu",
        predictedEpochSec: Math.floor(Date.now() / 1000) + 500,
      },
    ],
  },
  options: {
    locationBackup: true,
    notifications: false,
  },
};

let watchPosition;
let clearWatch;
let originalGeolocation;

beforeEach(() => {
  localStorage.clear();
  mocks.fetchStopMonitor.mockClear();
  mocks.runRideTestAlert.mockClear();
  mocks.stopRideAlerts.mockClear();

  originalGeolocation = navigator.geolocation;
  watchPosition = vi.fn((success) => {
    success({
      coords: {
        latitude: 61.1234,
        longitude: 23.5678,
        accuracy: 15,
      },
    });
    return 77;
  });
  clearWatch = vi.fn();

  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: {
      watchPosition,
      clearWatch,
    },
  });
});

afterEach(() => {
  vi.useRealTimers();
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: originalGeolocation,
  });
  localStorage.clear();
});

test("persists the ride but never persists the device GPS sample", async () => {
  const { result, unmount } = renderHook(() => useRideMode());

  act(() => {
    result.current.startRide(rideConfig);
  });

  await waitFor(() => expect(watchPosition).toHaveBeenCalledTimes(1));

  const stored = localStorage.getItem("foli-active-ride-v1");
  expect(stored).toContain('"tripRef":"trip-1"');
  expect(stored).not.toContain("61.1234");
  expect(stored).not.toContain("23.5678");

  act(() => {
    result.current.endRide();
  });

  expect(clearWatch).toHaveBeenCalledWith(77);
  expect(localStorage.getItem("foli-active-ride-v1")).toBeNull();
  unmount();
});

test("restores a non-expired active ride", () => {
  const stored = {
    id: "ride-restored",
    ...rideConfig,
    options: { locationBackup: false, notifications: false },
    stage: "next",
    stageReason: "schedule-fallback",
    stageConfidence: "schedule",
    startedAt: Date.now() - 60_000,
    expiresAt: Date.now() + 60_000,
  };

  localStorage.setItem("foli-active-ride-v1", JSON.stringify(stored));

  const { result } = renderHook(() => useRideMode());

  expect(result.current.session?.id).toBe("ride-restored");
  expect(result.current.session?.stage).toBe("next");
});

test("falls back to the timetable once the live prediction has gone stale", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  const startMs = Date.UTC(2026, 8, 21, 12, 0, 0);
  vi.setSystemTime(startMs);
  const nowSec = Math.floor(startMs / 1000);

  mocks.fetchStopMonitor.mockImplementation((stopId) =>
    Promise.resolve({
      serverTime: nowSec,
      arrivals:
        String(stopId) === "32"
          ? [
              {
                datedvehiclejourneyref: "journey-1",
                expectedarrivaltime: nowSec + 600,
                vehicleatstop: false,
                recordedattime: nowSec,
              },
            ]
          : [],
    })
  );

  const { result, unmount } = renderHook(() => useRideMode());

  act(() => {
    result.current.startRide({
      ...rideConfig,
      plan: {
        targetPredictedEpochSec: nowSec + 210,
        stopsToTarget: [
          { id: "11", name: "One", predictedEpochSec: nowSec + 90 },
          { id: "12", name: "Two", predictedEpochSec: nowSec + 150 },
          { id: "32", name: "Puistokatu", predictedEpochSec: nowSec + 210 },
        ],
      },
    });
  });

  // Three stops out, so the timetable alone reaches SOON. The provider then
  // answers with ten minutes, which must not be overtaken by the timetable.
  await waitFor(() => expect(result.current.runtime.liveEtaSec).toBe(600));
  expect(result.current.session?.stage).toBe("soon");

  // The provider goes quiet. The frozen prediction must stop counting as a
  // live answer, letting the timetable take over.
  vi.setSystemTime(startMs + 121_000);
  const onPosition = watchPosition.mock.calls[0][0];

  act(() => {
    onPosition({
      coords: { latitude: 61.1234, longitude: 23.5678, accuracy: 15 },
    });
  });

  expect(result.current.session?.stage).toBe("next");
  expect(result.current.session?.stageReason).toBe("schedule-fallback");
  expect(result.current.session?.stageConfidence).toBe("schedule");

  act(() => {
    result.current.endRide();
  });
  unmount();
});
