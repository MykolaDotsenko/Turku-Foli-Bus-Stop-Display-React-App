import { useCallback, useEffect, useRef, useState } from "react";
import { fetchStopAlerts } from "../api/foliApi";

const ALERT_REFRESH_INTERVAL_MS = 5 * 60 * 1000;

export default function useStopAlerts(stopId) {
  const [state, setState] = useState(() => ({ stopId, alerts: [] }));
  const abortRef = useRef(null);

  const refresh = useCallback(async () => {
    if (!stopId) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const alerts = await fetchStopAlerts(stopId, controller.signal);
      if (!controller.signal.aborted) {
        setState({ stopId, alerts });
      }
    } catch (error) {
      if (
        error?.name !== "CanceledError" &&
        error?.name !== "AbortError"
      ) {
        // Alerts are supplemental. Keep any same-stop alert data on failure.
      }
    }
  }, [stopId]);

  useEffect(() => {
    setState((current) =>
      current.stopId === stopId ? current : { stopId, alerts: [] }
    );
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
  }, [refresh, stopId]);

  return state.stopId === stopId ? state.alerts : [];
}
