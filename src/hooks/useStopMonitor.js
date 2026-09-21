import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchStopMonitor } from "../api/foliApi";

const REFRESH_INTERVAL_MS = 30_000;
const MAX_RETRY_INTERVAL_MS = 5 * 60_000;

const SNAPSHOT_KEY = "foli-last-departures-v1";
// Old enough to survive a reopen or a tunnel, short enough that every stored
// row is still a plausible departure rather than a misleading empty board.
const SNAPSHOT_TTL_MS = 15 * 60_000;
const MAX_SNAPSHOT_STOPS = 5;
const MAX_SNAPSHOT_ARRIVALS = 12;

function readSnapshots() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SNAPSHOT_KEY));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
}

function readSnapshot(stopId, nowMs = Date.now()) {
  const entry = readSnapshots()[String(stopId)];
  if (!entry || typeof entry !== "object" || !Array.isArray(entry.arrivals)) {
    return null;
  }

  const receivedAtMs = Number(entry.receivedAtMs);
  if (
    !Number.isFinite(receivedAtMs) ||
    receivedAtMs <= 0 ||
    receivedAtMs > nowMs ||
    nowMs - receivedAtMs > SNAPSHOT_TTL_MS
  ) {
    return null;
  }

  const serverTime = Number(entry.serverTime);

  return {
    stopId: String(stopId),
    stopName: typeof entry.stopName === "string" ? entry.stopName : "",
    arrivals: entry.arrivals,
    serverTime:
      Number.isFinite(serverTime) && serverTime > 0 ? serverTime : null,
    receivedAtMs,
  };
}

function writeSnapshot(data) {
  try {
    const snapshots = readSnapshots();
    snapshots[data.stopId] = {
      stopName: data.stopName,
      arrivals: data.arrivals.slice(0, MAX_SNAPSHOT_ARRIVALS),
      serverTime: data.serverTime,
      receivedAtMs: data.receivedAtMs,
    };

    const mostRecent = Object.entries(snapshots)
      .sort(
        ([, a], [, b]) =>
          (Number(b?.receivedAtMs) || 0) - (Number(a?.receivedAtMs) || 0)
      )
      .slice(0, MAX_SNAPSHOT_STOPS);

    localStorage.setItem(
      SNAPSHOT_KEY,
      JSON.stringify(Object.fromEntries(mostRecent))
    );
  } catch {
    // Offline continuity is a bonus. Live departures never depend on it.
  }
}

export function pollDelayMs(consecutiveFailures) {
  const failures = Math.max(0, Number(consecutiveFailures) || 0);
  if (failures <= 1) return REFRESH_INTERVAL_MS;

  return Math.min(
    REFRESH_INTERVAL_MS * 2 ** (failures - 1),
    MAX_RETRY_INTERVAL_MS
  );
}

function emptyData(stopId) {
  return {
    stopId,
    stopName: "",
    arrivals: [],
    serverTime: null,
    receivedAtMs: null,
  };
}

// The last payload this browser saw for the same stop, so reopening offline
// shows the recent board with its real age instead of nothing at all.
function startingData(stopId) {
  return readSnapshot(stopId) || emptyData(stopId);
}

export default function useStopMonitor(stopId) {
  const [data, setData] = useState(() => startingData(stopId));
  const [loading, setLoading] = useState(Boolean(stopId));
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const abortRef = useRef(null);
  const consecutiveFailuresRef = useRef(0);

  const refresh = useCallback(
    async ({ initial = false } = {}) => {
      if (!stopId) return null;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setError(false);
      initial ? setLoading(true) : setRefreshing(true);

      try {
        const next = await fetchStopMonitor(stopId, controller.signal);
        const received = { stopId, ...next, receivedAtMs: Date.now() };
        consecutiveFailuresRef.current = 0;
        setData(received);
        writeSnapshot(received);
        return true;
      } catch (err) {
        if (err?.name !== "CanceledError" && err?.name !== "AbortError") {
          consecutiveFailuresRef.current += 1;
          setError(true);
          return false;
        }

        return null;
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [stopId]
  );

  useEffect(() => {
    if (!stopId) {
      abortRef.current?.abort();
      consecutiveFailuresRef.current = 0;
      setData(emptyData(""));
      setLoading(false);
      setRefreshing(false);
      setError(false);
      return undefined;
    }

    let active = true;
    let timeoutId = null;

    const scheduleNext = () => {
      if (!active) return;
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(async () => {
        if (document.visibilityState === "visible") {
          await refresh();
        }
        scheduleNext();
      }, pollDelayMs(consecutiveFailuresRef.current));
    };

    const runInitial = async () => {
      consecutiveFailuresRef.current = 0;
      setData(startingData(stopId));
      setError(false);
      setRefreshing(false);
      await refresh({ initial: true });
      scheduleNext();
    };

    const refreshNowAndReschedule = async () => {
      if (!active) return;
      window.clearTimeout(timeoutId);
      await refresh();
      scheduleNext();
    };

    const handleVisibilityChange = async () => {
      if (document.visibilityState !== "visible") return;
      await refreshNowAndReschedule();
    };

    const handleOnline = async () => {
      if (document.visibilityState !== "visible") return;
      await refreshNowAndReschedule();
    };

    runInitial();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("online", handleOnline);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("online", handleOnline);
      abortRef.current?.abort();
    };
  }, [refresh, stopId]);

  const isCurrentStop = data.stopId === stopId;
  // Allocating this per render would give `arrivals` a new identity on every
  // render while a newly selected stop loads, which re-triggers every consumer
  // memo/effect keyed on it and can spin a synchronous re-render loop.
  const pendingData = useMemo(() => startingData(stopId), [stopId]);

  return {
    ...(isCurrentStop ? data : pendingData),
    loading: !isCurrentStop || loading,
    refreshing: isCurrentStop && refreshing,
    error: isCurrentStop && error,
    refresh,
  };
}
