import { useCallback, useEffect, useRef, useState } from "react";
import { fetchStopMonitor } from "../api/foliApi";

const REFRESH_INTERVAL_MS = 30_000;
const MAX_RETRY_INTERVAL_MS = 5 * 60_000;

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

export default function useStopMonitor(stopId) {
  const [data, setData] = useState(() => emptyData(stopId));
  const [loading, setLoading] = useState(true);
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
        consecutiveFailuresRef.current = 0;
        setData({ stopId, ...next, receivedAtMs: Date.now() });
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
      setData(emptyData(stopId));
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

  return {
    ...(isCurrentStop ? data : emptyData(stopId)),
    loading: !isCurrentStop || loading,
    refreshing: isCurrentStop && refreshing,
    error: isCurrentStop && error,
    refresh,
  };
}
