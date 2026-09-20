import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchAlerts } from "../api/foliApi";
import { extractStopAlerts } from "../utils/alerts";

const ALERT_REFRESH_INTERVAL_MS = 5 * 60 * 1000;

export default function useStopAlerts(stopId, lineRefs, routesById) {
  const [payload, setPayload] = useState(null);
  const [receivedAtMs, setReceivedAtMs] = useState(null);
  const [error, setError] = useState(false);
  const abortRef = useRef(null);

  const refresh = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setError(false);

    try {
      const nextPayload = await fetchAlerts(controller.signal);
      if (!controller.signal.aborted) {
        setPayload(nextPayload);
        setReceivedAtMs(Date.now());
      }
    } catch (requestError) {
      if (
        requestError?.name !== "CanceledError" &&
        requestError?.name !== "AbortError"
      ) {
        setError(true);
        // Keep the last successful payload, but expose its age to the UI.
      }
    }
  }, []);

  useEffect(() => {
    refresh();

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, ALERT_REFRESH_INTERVAL_MS);

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

  const alerts = useMemo(
    () =>
      extractStopAlerts(payload, {
        stopId,
        lineRefs,
        routesById,
      }),
    [lineRefs, payload, routesById, stopId]
  );

  return {
    alerts,
    error,
    receivedAtMs,
  };
}
