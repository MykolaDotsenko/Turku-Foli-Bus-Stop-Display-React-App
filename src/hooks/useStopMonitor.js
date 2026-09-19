import { useCallback, useEffect, useRef, useState } from "react";
import { fetchStopMonitor } from "../api/foliApi";

const REFRESH_INTERVAL_MS = 30_000;

export default function useStopMonitor(stopId) {
  const [data, setData] = useState({
    stopName: "",
    arrivals: [],
    serverTime: null,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const abortRef = useRef(null);

  const refresh = useCallback(
    async ({ initial = false } = {}) => {
      if (!stopId) return;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      initial ? setLoading(true) : setRefreshing(true);

      try {
        const next = await fetchStopMonitor(stopId, controller.signal);
        setData(next);
        setError("");
      } catch (err) {
        if (err?.name !== "CanceledError" && err?.name !== "AbortError") {
          setError(err?.message || "Could not update departures.");
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
