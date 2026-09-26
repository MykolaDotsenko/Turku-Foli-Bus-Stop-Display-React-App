import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchStopMonitor: vi.fn(() => new Promise(() => {})),
  fetchTripShape: vi.fn(() =>
    Promise.resolve([
      { lat: 60.4518, lon: 22.2666, traveled: 0 },
      { lat: 60.4488, lon: 22.255, traveled: 1100 },
    ])
  ),
  runRideTestAlert: vi.fn(() => Promise.resolve()),
  stopRideAlerts: vi.fn(),
  requestRideNotificationPermission: vi.fn(() => Promise.resolve(false)),
  announceRideStage: vi.fn(),
  repeatNowRideSignal: vi.fn(),
  primeRideVoices: vi.fn(() => true),
  unlockRideAudio: vi.fn(() => Promise.resolve(true)),
}));

vi.mock("../api/foliApi", () => ({
  fetchStopMonitor: mocks.fetchStopMonitor,
  fetchTripShape: mocks.fetchTripShape,
}));

vi.mock("../utils/rideAlerts", () => ({
  announceRideStage: mocks.announceRideStage,
  repeatNowRideSignal: mocks.repeatNowRideSignal,
  requestRideNotificationPermission: mocks.requestRideNotificationPermission,
  runRideTestAlert: mocks.runRideTestAlert,
  stopRideAlerts: mocks.stopRideAlerts,
  primeRideVoices: mocks.primeRideVoices,
  unlockRideAudio: mocks.unlockRideAudio,
}));

import useRideMode from "./useRideMode";

const rideConfig = {
  lineRef: "1",
  destination: "Satama",
  tripRef: "trip-1",
  routeType: 3,
  shapeId: "shape-1",
  datedVehicleJourneyRef: "journey-1",
  vehicleRef: "bus-1",
  originAimedDepartureTime: 1000,
  boardingStop: {
    id: "164",
    name: "Kauppatori",
    shapeDistTraveled: 0,
  },
  targetStop: {
    id: "32",
    name: "Puistokatu",
    lat: 60.4488,
    lon: 22.255,
    shapeDistTraveled: 1100,
  },
  previousStop: { id: "164", name: "Kauppatori" },
  nextStop: { id: "4", name: "Turun linna" },
  plan: {
    boardingStop: {
      id: "164",
      name: "Kauppatori",
      shapeDistTraveled: 0,
    },
    targetStop: {
      id: "32",
      name: "Puistokatu",
      shapeDistTraveled: 1100,
    },
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
  mocks.fetchTripShape.mockClear();
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


test("map-matched GPS can advance Ride Mode to NEXT without SIRI proximity", async () => {
  let deliverGps = null;
  watchPosition.mockImplementation((success) => {
    deliverGps = success;
    return 88;
  });

  const { result, unmount } = renderHook(() => useRideMode());

  act(() => {
    result.current.startRide(rideConfig);
  });

  await waitFor(() => {
    expect(result.current.gps.shapeStatus).toBe("ready");
  });

  act(() => {
    deliverGps({
      coords: {
        latitude: 60.4493,
        longitude: 22.2569,
        accuracy: 18,
        speed: 8,
      },
    });
  });

  await waitFor(() => {
    expect(result.current.session?.stage).toBe("next");
  });

  expect(result.current.session?.stageReason).toBe("gps-route-distance");
  expect(result.current.gps.onRoute).toBe(true);
  expect(result.current.gps.routeDistanceM).toBeLessThan(600);
  expect(result.current.gps.routeDistanceM).toBeGreaterThan(0);

  act(() => {
    result.current.endRide();
  });
  expect(clearWatch).toHaveBeenCalledWith(88);
  unmount();
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
                monitored: true,
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

test("an early pass near the target cannot later fake a missed stop", async () => {
  // Fifteen minutes before the target, the route drives a block from it. That
  // old fix must neither announce arrival later nor arm the "gone past it"
  // latch, or the passenger is told to get off while still approaching.
  vi.useFakeTimers({ toFake: ["Date"] });
  const startMs = Date.UTC(2026, 8, 21, 9, 0, 0);
  vi.setSystemTime(startMs);
  const nowSec = Math.floor(startMs / 1000);

  let deliverGps = null;
  watchPosition.mockImplementation((success) => {
    deliverGps = success;
    return 91;
  });

  let etaOffsetSec = 900;
  mocks.fetchStopMonitor.mockImplementation((stopId) =>
    Promise.resolve({
      serverTime: Math.floor(Date.now() / 1000),
      arrivals:
        String(stopId) === "32"
          ? [
              {
                datedvehiclejourneyref: "journey-1",
                monitored: true,
                expectedarrivaltime:
                  Math.floor(Date.now() / 1000) + etaOffsetSec,
                vehicleatstop: false,
                recordedattime: Math.floor(Date.now() / 1000),
              },
            ]
          : [],
    })
  );

  const { result, unmount } = renderHook(() => useRideMode());

  act(() => {
    result.current.startRide({
      ...rideConfig,
      shapeId: "",
      plan: {
        targetPredictedEpochSec: nowSec + 900,
        stopsToTarget: [
          { id: "11", name: "One", predictedEpochSec: nowSec + 300 },
          { id: "12", name: "Two", predictedEpochSec: nowSec + 600 },
          { id: "32", name: "Puistokatu", predictedEpochSec: nowSec + 900 },
        ],
      },
    });
  });

  await waitFor(() => expect(deliverGps).not.toBeNull());
  await waitFor(() => expect(result.current.runtime.liveEtaSec).toBe(900));

  // The early pass, fifty metres from a stop that is still fifteen minutes out.
  act(() => {
    deliverGps({
      coords: { latitude: 60.4492, longitude: 22.2555, accuracy: 15 },
    });
  });
  expect(result.current.session?.stage).toBe("boarded");

  // Fifteen minutes later the provider puts the stop one minute away. The old
  // fix is far too stale to mean "you are at the stop".
  vi.setSystemTime(startMs + 15 * 60_000);
  etaOffsetSec = 60;
  act(() => {
    document.dispatchEvent(new globalThis.Event("visibilitychange"));
  });
  await waitFor(() => expect(result.current.session?.stage).toBe("next"));

  // A fresh sample from the real approach, still several hundred metres short.
  act(() => {
    deliverGps({
      coords: { latitude: 60.4455, longitude: 22.261, accuracy: 15 },
    });
  });

  expect(result.current.session?.stage).toBe("next");

  act(() => {
    result.current.endRide();
  });
  unmount();
});

test("the shown estimate falls back with the stage logic instead of freezing", async () => {
  // A failed poll leaves the previous prediction in runtime. Showing it as a
  // confident "~2 min" beside a badge that already reads "schedule" tells the
  // passenger two different things at once.
  vi.useFakeTimers({ toFake: ["Date"] });
  const startMs = Date.UTC(2026, 8, 21, 11, 0, 0);
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
                monitored: true,
                expectedarrivaltime: nowSec + 120,
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
      shapeId: "",
      options: { locationBackup: false, notifications: false },
      plan: {
        targetPredictedEpochSec: nowSec + 1_800,
        stopsToTarget: [
          { id: "11", name: "One", predictedEpochSec: nowSec + 900 },
          { id: "32", name: "Puistokatu", predictedEpochSec: nowSec + 1_800 },
        ],
      },
    });
  });

  await waitFor(() => expect(result.current.runtime.etaSec).toBe(120));

  // The provider goes quiet for five minutes.
  vi.setSystemTime(startMs + 5 * 60_000);
  mocks.fetchStopMonitor.mockImplementation(() =>
    Promise.reject(new Error("provider unavailable"))
  );
  act(() => {
    document.dispatchEvent(new globalThis.Event("visibilitychange"));
  });

  await waitFor(() => {
    expect(result.current.runtime.trackingHealth).not.toBe("live");
  });

  // The frozen 120 seconds must not still be on show.
  expect(result.current.runtime.etaSec).not.toBe(120);

  act(() => {
    result.current.endRide();
  });
  unmount();
});

test("a timetable-only listing at the target never reads as live tracking", async () => {
  // The feed still lists the journey but is not tracking it, so the time on
  // the row is the raw timetable: one minute out. The plan, anchored to the
  // real departure, has the bus five stops and eight minutes away. Reading
  // that row as live showed "Following your bus" and "Press STOP now".
  vi.useFakeTimers({ toFake: ["Date"] });
  const startMs = Date.UTC(2026, 8, 21, 13, 0, 0);
  vi.setSystemTime(startMs);
  const nowSec = Math.floor(startMs / 1000);

  mocks.fetchStopMonitor.mockImplementation((stopId) =>
    Promise.resolve({
      serverTime: nowSec,
      realtimeAvailable: true,
      arrivals:
        String(stopId) === "32"
          ? [
              {
                datedvehiclejourneyref: "journey-1",
                tripref: "trip-1",
                lineref: "1",
                monitored: false,
                vehicleatstop: false,
                aimedarrivaltime: nowSec + 60,
                aimeddeparturetime: nowSec + 60,
              },
            ]
          : [],
    })
  );

  const { result, unmount } = renderHook(() => useRideMode());

  act(() => {
    result.current.startRide({
      ...rideConfig,
      shapeId: "",
      options: { locationBackup: false, notifications: false },
      plan: {
        targetPredictedEpochSec: nowSec + 500,
        stopsToTarget: [
          { id: "11", name: "One", predictedEpochSec: nowSec + 100 },
          { id: "12", name: "Two", predictedEpochSec: nowSec + 200 },
          { id: "13", name: "Three", predictedEpochSec: nowSec + 300 },
          { id: "14", name: "Four", predictedEpochSec: nowSec + 400 },
          { id: "32", name: "Puistokatu", predictedEpochSec: nowSec + 500 },
        ],
      },
    });
  });

  await waitFor(() => expect(result.current.runtime.lastPollAt).not.toBeNull());

  expect(result.current.runtime.trackingHealth).toBe("schedule");
  expect(result.current.runtime.targetMatchBy).toBe("");
  expect(result.current.runtime.etaSec).toBe(500);
  expect(result.current.session?.stage).toBe("boarded");

  act(() => {
    result.current.endRide();
  });
  unmount();
  mocks.fetchStopMonitor.mockImplementation(() => new Promise(() => {}));
});
