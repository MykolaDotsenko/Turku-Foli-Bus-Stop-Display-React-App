import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchAlerts, fetchStopServedRouteIds } from "../api/foliApi";
import { extractStopAlerts } from "../utils/alerts";

const ALERT_REFRESH_INTERVAL_MS = 5 * 60 * 1000;
// Reused so "no served routes" never produces a fresh identity on every run.
const EMPTY_ROUTE_IDS = new Set();

export default function useStopAlerts(stopId, lineRefs, routesById) {
  const [payload, setPayload] = useState(null);
  const [receivedAtMs, setReceivedAtMs] = useState(null);
  const [error, setError] = useState(false);
  const [servedRouteIds, setServedRouteIds] = useState(EMPTY_ROUTE_IDS);
  const abortRef = useRef(null);
  const membershipAbortRef = useRef(null);
  const preferredLanguages = useMemo(() => {
    if (typeof navigator === "undefined") return ["en"];
    const languages = Array.isArray(navigator.languages)
      ? navigator.languages
      : [navigator.language];
    return languages.filter(Boolean);
  }, []);

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
    membershipAbortRef.current?.abort();
    const controller = new AbortController();
    membershipAbortRef.current = controller;

    const activeLineSet = new Set(lineRefs.map(String));
    const candidateRouteIds = [
      ...new Set(
        (Array.isArray(payload?.messages) ? payload.messages : [])
          .filter(
            (message) =>
              message?.isactive === true &&
              !(Array.isArray(message?.affected_stops) &&
                message.affected_stops.some(
                  (affectedStop) =>
                    String(affectedStop) === String(stopId)
                ))
          )
          .flatMap((message) =>
            Array.isArray(message?.affected_routes)
              ? message.affected_routes
              : []
          )
          .map(String)
          .filter(Boolean)
          .filter((routeId) => {
            const shortName = routesById.get(routeId)?.shortName;
            return !shortName || !activeLineSet.has(String(shortName));
          })
      ),
    ];

    if (!stopId || candidateRouteIds.length === 0) {
      setServedRouteIds(EMPTY_ROUTE_IDS);
      return () => controller.abort();
    }

    fetchStopServedRouteIds(stopId, candidateRouteIds, controller.signal)
      .then((routeIds) => {
        if (!controller.signal.aborted) setServedRouteIds(routeIds);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          // Realtime line matching still provides a safe partial fallback.
          setServedRouteIds(EMPTY_ROUTE_IDS);
        }
      });

    return () => controller.abort();
  }, [lineRefs, payload, routesById, stopId]);

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
      membershipAbortRef.current?.abort();
    };
  }, [refresh]);

  const alerts = useMemo(
    () =>
      extractStopAlerts(payload, {
        stopId,
        lineRefs,
        routesById,
        preferredLanguages,
        servedRouteIds,
      }),
    [
      lineRefs,
      payload,
      preferredLanguages,
      routesById,
      servedRouteIds,
      stopId,
    ]
  );

  return {
    alerts,
    error,
    receivedAtMs,
  };
}
