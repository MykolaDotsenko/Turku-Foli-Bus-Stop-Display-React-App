import { useCallback, useEffect, useRef, useState } from "react";
import { fetchStopMonitor } from "../api/foliApi";

const REFRESH_INTERVAL_MS = 30_000;

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

  const refresh = useCallback(
    async ({ initial = false } = {}) => {
      if (!stopId) return;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setError(false);
      initial ? setLoading(true) : setRefreshing(true);

      try {
        const next = await fetchStopMonitor(stopId, controller.signal);
        setData({ stopId, ...next, receivedAtMs: Date.now() });
      } catch (err) {
        if (err?.name !== "CanceledError" && err?.name !== "AbortError") {
          setError(true);
        }
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
    setData(emptyData(stopId));
    setError(false);
    setRefreshing(false);
    refresh({ initial: true });

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, REFRESH_INTERVAL_MS);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") refresh();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
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
