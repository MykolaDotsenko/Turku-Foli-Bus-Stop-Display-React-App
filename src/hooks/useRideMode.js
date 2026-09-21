import { useCallback, useEffect, useRef, useState } from "react";
import { fetchStopMonitor, fetchTripShape } from "../api/foliApi";
import { distanceInMeters, hasCoordinates } from "../utils/geo";
import { analyzeRideGps, prepareRideShape } from "../utils/rideGeometry";
import {
  announceRideStage,
  repeatNowRideSignal,
  requestRideNotificationPermission,
  runRideTestAlert,
  stopRideAlerts,
} from "../utils/rideAlerts";
import {
  RIDE_STAGE,
  arrivalEtaSeconds,
  evaluateRideStage,
  matchRideArrival,
  plannedRideProgress,
} from "../utils/rideProgress";
import { dataAgeSeconds } from "../utils/time";

const STORAGE_KEY = "foli-active-ride-v1";
const RIDE_TTL_MS = 6 * 60 * 60 * 1000;
const POLL_INTERVAL_MS = 20_000;
const CLOCK_INTERVAL_MS = 10_000;
const NOW_REPEAT_MS = 5_000;

function emptyRuntime() {
  return {
    lastPollAt: null,
    lastProviderSuccessAt: null,
    lastLiveMatchAt: null,
    previousSeen: false,
    previousMissingCount: 0,
    targetMissingCount: 0,
    targetWasAtStop: false,
    targetListed: false,
    targetMatchBy: "",
    liveEtaSec: null,
    providerDistanceM: null,
    providerPositionAgeSec: null,
    scheduleEtaSec: null,
    remainingStops: null,
    trackingHealth: "schedule",
    lastError: "",
    notificationPermission: "unknown",
  };
}

function emptyGps() {
  return {
    status: "off",
    distanceM: null,
    accuracyM: null,
    speedMps: null,
    minimumDistanceM: null,
    wasNearTarget: false,
    movedAwayAfterNear: false,
    shapeStatus: "idle",
    shapeUsable: false,
    onRoute: false,
    alongRouteM: null,
    lateralDistanceM: null,
    routeDistanceM: null,
    routeEtaSec: null,
    offRouteSinceMs: null,
    offRouteSuspected: false,
    passedTarget: false,
    updatedAt: null,
    error: "",
  };
}

function validStoredRide(value) {
  return (
    value &&
    typeof value === "object" &&
    typeof value.id === "string" &&
    value.targetStop &&
    /^\d+$/.test(String(value.targetStop.id || "")) &&
    value.plan &&
    Number(value.expiresAt) > Date.now()
  );
}

function readStoredRide() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (validStoredRide(parsed)) return parsed;
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // A corrupt convenience record must never block the departure board.
  }
  return null;
}

function persistRide(session) {
  try {
    if (!session) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Ride tracking continues in-memory even if storage is unavailable.
  }
}

function createRideId() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `ride-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function rideIdentity(session) {
  return {
    datedVehicleJourneyRef: session.datedVehicleJourneyRef,
    tripRef: session.tripRef,
    vehicleRef: session.vehicleRef,
    lineRef: session.lineRef,
    originAimedDepartureTime: session.originAimedDepartureTime,
  };
}

function trackingHealth(runtime, online = globalThis.navigator?.onLine !== false) {
  if (!online) return "schedule";

  const lastLive = Number(runtime.lastLiveMatchAt);
  if (!Number.isFinite(lastLive) || lastLive <= 0) return "schedule";

  const ageMs = Date.now() - lastLive;
  if (ageMs <= 45_000) return "live";
  if (ageMs <= 120_000) return "delayed";
  return "schedule";
}

function providerDistanceToTarget(arrival, targetStop) {
  if (
    !hasCoordinates(targetStop) ||
    !hasCoordinates({ lat: arrival?.latitude, lon: arrival?.longitude })
  ) {
    return null;
  }

  const distance = distanceInMeters(
    { lat: arrival.latitude, lon: arrival.longitude },
    targetStop
  );

  return Number.isFinite(distance) ? distance : null;
}

export default function useRideMode() {
  const initialRideRef = useRef(null);
  if (initialRideRef.current === null) {
    initialRideRef.current = readStoredRide() || false;
  }

  const [session, setSession] = useState(
    initialRideRef.current === false ? null : initialRideRef.current
  );
  const [runtime, setRuntimeState] = useState(emptyRuntime);
  const [gps, setGpsState] = useState(emptyGps);
  const [wakeLockState, setWakeLockState] = useState("inactive");

  const sessionRef = useRef(session);
  const runtimeRef = useRef(runtime);
  const gpsRef = useRef(gps);
  const shapeRef = useRef(null);

  const commitSession = useCallback((updater) => {
    setSession((current) => {
      const next =
        typeof updater === "function" ? updater(current) : updater;
      sessionRef.current = next;
      persistRide(next);
      return next;
    });
  }, []);

  const commitRuntime = useCallback((updater) => {
    setRuntimeState((current) => {
      const next =
        typeof updater === "function" ? updater(current) : updater;
      runtimeRef.current = next;
      return next;
    });
  }, []);

  const commitGps = useCallback((updater) => {
    setGpsState((current) => {
      const next =
        typeof updater === "function" ? updater(current) : updater;
      gpsRef.current = next;
      return next;
    });
  }, []);

  const endRide = useCallback(() => {
    stopRideAlerts();
    shapeRef.current = null;
    commitSession(null);
    commitRuntime(emptyRuntime());
    commitGps(emptyGps());
  }, [commitGps, commitRuntime, commitSession]);

  const applyProgress = useCallback(
    (nextRuntime = runtimeRef.current, nextGps = gpsRef.current) => {
      const current = sessionRef.current;
      if (!current) return;

      if (Date.now() >= Number(current.expiresAt || 0)) {
        endRide();
        return;
      }

      const planned = plannedRideProgress(
        current.plan,
        Math.floor(Date.now() / 1000)
      );

      const gpsMovedAway =
        nextGps.wasNearTarget === true &&
        nextGps.movedAwayAfterNear === true;

      const previousPassedConfirmed =
        nextRuntime.previousSeen === true &&
        nextRuntime.previousMissingCount >= 2 &&
        nextRuntime.targetListed === true;

      const targetPassedConfirmed =
        nextRuntime.targetWasAtStop === true &&
        nextRuntime.targetMissingCount >= 2;

      const evaluated = evaluateRideStage(current.stage, {
        liveEtaSec: nextRuntime.liveEtaSec,
        scheduleEtaSec: planned.etaSec,
        remainingStops: planned.remainingStops,
        providerDistanceM: nextRuntime.providerDistanceM,
        providerPositionAgeSec: nextRuntime.providerPositionAgeSec,
        gpsDistanceM: nextGps.distanceM,
        gpsAccuracyM: nextGps.accuracyM,
        gpsShapeAvailable: nextGps.shapeStatus === "ready",
        gpsShapeUsable: nextGps.shapeUsable,
        gpsOnRoute: nextGps.onRoute,
        gpsRouteDistanceM: nextGps.routeDistanceM,
        gpsRouteEtaSec: nextGps.routeEtaSec,
        gpsPassedTarget: nextGps.passedTarget,
        previousPassedConfirmed,
        targetAtStop: nextRuntime.targetWasAtStop && nextRuntime.targetListed,
        targetPassedConfirmed,
        gpsMovedAwayAfterNear: gpsMovedAway,
        lastReason: current.stageReason,
        lastConfidence: current.stageConfidence,
      });

      const health = trackingHealth(nextRuntime);
      const mergedRuntime = {
        ...nextRuntime,
        scheduleEtaSec: planned.etaSec,
        remainingStops: planned.remainingStops,
        trackingHealth: health,
      };
      runtimeRef.current = mergedRuntime;
      setRuntimeState(mergedRuntime);

      if (evaluated.stage === current.stage) return;

      const nextSession = {
        ...current,
        stage: evaluated.stage,
        stageReason: evaluated.reason,
        stageConfidence: evaluated.confidence,
        stageChangedAt: Date.now(),
      };

      sessionRef.current = nextSession;
      setSession(nextSession);
      persistRide(nextSession);

      if (
        evaluated.stage === RIDE_STAGE.SOON ||
        evaluated.stage === RIDE_STAGE.NEXT ||
        evaluated.stage === RIDE_STAGE.NOW ||
        evaluated.stage === RIDE_STAGE.MISSED
      ) {
        announceRideStage(
          evaluated.stage,
          current.targetStop.name,
          current.options?.notifications !== false,
          current.routeType
        );
      }
    },
    [endRide]
  );

  const startRide = useCallback(
    (config) => {
      if (!config?.targetStop || !config?.plan) return false;

      const now = Date.now();
      const nextSession = {
        id: createRideId(),
        ...config,
        stage: RIDE_STAGE.BOARDED,
        stageReason: "tracking",
        stageConfidence: "live",
        startedAt: now,
        stageChangedAt: now,
        expiresAt: now + RIDE_TTL_MS,
      };

      stopRideAlerts();
      commitRuntime(emptyRuntime());
      commitGps(emptyGps());
      commitSession(nextSession);

      const wantsNotifications =
        nextSession.options?.notifications !== false;

      if (wantsNotifications) {
        void requestRideNotificationPermission().then((granted) => {
          commitRuntime((current) => ({
            ...current,
            notificationPermission: granted ? "granted" : "unavailable",
          }));
        });
      }

      void runRideTestAlert(
        nextSession.targetStop.name,
        wantsNotifications
      );

      return true;
    },
    [commitGps, commitRuntime, commitSession]
  );

  const testAlert = useCallback(() => {
    const current = sessionRef.current;
    if (!current) return;
    void runRideTestAlert(
      current.targetStop.name,
      current.options?.notifications !== false
    );
  }, []);

  useEffect(() => {
    const current = sessionRef.current;
    if (!current?.options?.locationBackup) {
      commitGps(emptyGps());
      return undefined;
    }

    if (
      !hasCoordinates(current.targetStop) ||
      typeof globalThis.navigator?.geolocation?.watchPosition !== "function"
    ) {
      commitGps((value) => ({
        ...value,
        status: "unavailable",
        error: "Location backup is unavailable on this device.",
      }));
      return undefined;
    }

    let active = true;
    commitGps((value) => ({
      ...value,
      status: "starting",
      error: "",
    }));

    const watchId = globalThis.navigator.geolocation.watchPosition(
      (position) => {
        if (!active) return;

        const point = {
          lat: Number(position?.coords?.latitude),
          lon: Number(position?.coords?.longitude),
        };
        const accuracy = Number(position?.coords?.accuracy);

        if (!hasCoordinates(point)) return;

        const distance = distanceInMeters(point, current.targetStop);
        if (!Number.isFinite(distance)) return;

        const previous = gpsRef.current;
        const minimumDistance =
          previous.minimumDistanceM === null
            ? distance
            : Math.min(previous.minimumDistanceM, distance);
        const wasNearTarget =
          previous.wasNearTarget === true || minimumDistance <= 80;
        const movedAwayAfterNear =
          wasNearTarget && distance >= 250 && distance > minimumDistance + 120;

        const next = {
          status:
            Number.isFinite(accuracy) && accuracy > 120 ? "weak" : "active",
          distanceM: distance,
          accuracyM: Number.isFinite(accuracy) ? accuracy : null,
          minimumDistanceM: minimumDistance,
          wasNearTarget,
          movedAwayAfterNear,
          updatedAt: Date.now(),
          error: "",
        };

        gpsRef.current = next;
        setGpsState(next);
        applyProgress(runtimeRef.current, next);
      },
      (error) => {
        if (!active) return;
        commitGps((value) => ({
          ...value,
          status: "error",
          error:
            error?.code === 1
              ? "Location backup was not allowed."
              : "Location backup is temporarily unavailable.",
        }));
      },
      {
        enableHighAccuracy: true,
        maximumAge: 10_000,
        timeout: 15_000,
      }
    );

    return () => {
      active = false;
      globalThis.navigator?.geolocation?.clearWatch?.(watchId);
    };
  }, [applyProgress, commitGps, session?.id, session?.options?.locationBackup]);

  useEffect(() => {
    if (!session) {
      setWakeLockState("inactive");
      return undefined;
    }

    if (typeof globalThis.navigator?.wakeLock?.request !== "function") {
      setWakeLockState("unsupported");
      return undefined;
    }

    let active = true;
    let sentinel = null;

    const request = async () => {
      if (!active || document.visibilityState !== "visible") return;

      try {
        sentinel = await globalThis.navigator.wakeLock.request("screen");
        if (!active) {
          await sentinel.release?.();
          return;
        }
        setWakeLockState("active");
        sentinel.addEventListener?.("release", () => {
          sentinel = null;
          if (active) setWakeLockState("inactive");
        });
      } catch {
        if (active) setWakeLockState("inactive");
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible" && !sentinel) {
        void request();
      }
    };

    void request();
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      active = false;
      document.removeEventListener("visibilitychange", handleVisibility);
      void sentinel?.release?.();
    };
  }, [session?.id]);

  useEffect(() => {
    if (!session) return undefined;

    let active = true;
    let timeoutId = null;
    let controller = null;

    const schedule = () => {
      if (!active) return;
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(runPoll, POLL_INTERVAL_MS);
    };

    const runPoll = async () => {
      if (!active) return;

      const current = sessionRef.current;
      if (!current) return;

      controller?.abort();
      controller = new AbortController();
      const signal = controller.signal;

      const targetPromise = fetchStopMonitor(current.targetStop.id, signal);
      const previousPromise = current.previousStop?.id
        ? fetchStopMonitor(current.previousStop.id, signal)
        : Promise.resolve(null);

      const [targetResult, previousResult] = await Promise.allSettled([
        targetPromise,
        previousPromise,
      ]);

      if (!active || signal.aborted) return;

      const before = runtimeRef.current;
      let next = {
        ...before,
        lastPollAt: Date.now(),
        lastError: "",
      };

      const identity = rideIdentity(current);
      let targetMatch = null;

      if (targetResult.status === "fulfilled") {
        next.lastProviderSuccessAt = Date.now();
        targetMatch = matchRideArrival(
          targetResult.value?.arrivals,
          identity
        );
        next.targetListed = Boolean(targetMatch);
        next.targetMatchBy = targetMatch?.matchedBy || "";

        if (targetMatch) {
          next.lastLiveMatchAt = Date.now();
          next.targetMissingCount = 0;
          next.targetWasAtStop =
            next.targetWasAtStop || targetMatch.arrival.vehicleatstop === true;
          next.liveEtaSec = arrivalEtaSeconds(
            targetMatch.arrival,
            targetResult.value.serverTime
          );
          next.providerDistanceM = providerDistanceToTarget(
            targetMatch.arrival,
            current.targetStop
          );
          next.providerPositionAgeSec = dataAgeSeconds(
            targetMatch.arrival.recordedattime,
            targetResult.value.serverTime
          );
        } else {
          next.targetMissingCount =
            before.targetListed ||
            before.targetMissingCount > 0 ||
            before.targetWasAtStop
              ? before.targetMissingCount + 1
              : 0;
          next.liveEtaSec = null;
          next.providerDistanceM = null;
          next.providerPositionAgeSec = null;
        }
      } else {
        next.lastError = "Live target-stop tracking is temporarily unavailable.";
      }

      if (previousResult.status === "fulfilled" && previousResult.value) {
        next.lastProviderSuccessAt = Date.now();
        const previousMatch = matchRideArrival(
          previousResult.value.arrivals,
          identity
        );

        if (previousMatch) {
          next.lastLiveMatchAt = Date.now();
          next.previousSeen = true;
          next.previousMissingCount = 0;
        } else if (before.previousSeen) {
          next.previousMissingCount = before.previousMissingCount + 1;
        }
      } else if (previousResult.status === "rejected") {
        next.lastError =
          next.lastError || "Previous-stop tracking is temporarily unavailable.";
      }

      next.trackingHealth = trackingHealth(next);
      runtimeRef.current = next;
      setRuntimeState(next);
      applyProgress(next, gpsRef.current);
      schedule();
    };

    const handleVisible = () => {
      if (document.visibilityState === "visible") {
        window.clearTimeout(timeoutId);
        void runPoll();
      }
    };
    const handleOnline = () => {
      window.clearTimeout(timeoutId);
      void runPoll();
    };

    void runPoll();
    document.addEventListener("visibilitychange", handleVisible);
    window.addEventListener("online", handleOnline);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
      controller?.abort();
      document.removeEventListener("visibilitychange", handleVisible);
      window.removeEventListener("online", handleOnline);
    };
  }, [applyProgress, session?.id]);

  useEffect(() => {
    if (!session) return undefined;

    const id = window.setInterval(() => {
      const next = {
        ...runtimeRef.current,
        trackingHealth: trackingHealth(runtimeRef.current),
      };
      applyProgress(next, gpsRef.current);
    }, CLOCK_INTERVAL_MS);

    return () => window.clearInterval(id);
  }, [applyProgress, session?.id]);

  useEffect(() => {
    if (session?.stage !== RIDE_STAGE.NOW) return undefined;

    const id = window.setInterval(() => {
      repeatNowRideSignal();
    }, NOW_REPEAT_MS);

    return () => window.clearInterval(id);
  }, [session?.stage]);

  useEffect(
    () => () => {
      stopRideAlerts();
    },
    []
  );

  return {
    session,
    runtime,
    gps,
    wakeLockState,
    active: Boolean(session),
    startRide,
    endRide,
    testAlert,
  };
}
