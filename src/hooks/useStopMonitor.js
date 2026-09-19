import { useCallback, useEffect, useRef, useState } from "react";
import { fetchStopMonitor } from "../api/foliApi";

const REFRESH_INTERVAL_MS = 30_000;
const EMPTY_DATA = {
  stopName: "",
  arrivals: [],
  serverTime: null,
};

export default function useStopMonitor(stopId) {
  const [data, setData] = useState(EMPTY_DATA);
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
        setData(await fetchStopMonitor(stopId, controller.signal));
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
    // Data from one stop must never appear under another stop number.
    setData(EMPTY_DATA);
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
  }, [refresh]);

  return { ...data, loading, refreshing, error, refresh };
}
