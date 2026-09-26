import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchAlerts, fetchStopServedRouteIds } from "../api/foliApi";
import { providerLanguages, useLanguage } from "../i18n";
import { extractStopAlerts } from "../utils/alerts";

const ALERT_REFRESH_INTERVAL_MS = 5 * 60 * 1000;
// Reused so "no served routes" never produces a fresh identity on every run.
const EMPTY_ROUTE_IDS = new Set();

export default function useStopAlerts(stopId, lineRefs, routesById) {
  const [payload, setPayload] = useState(null);
  const [receivedAtMs, setReceivedAtMs] = useState(null);
  const [error, setError] = useState(false);
  // Kept with the stop it was looked up for. Kept bare, one stop's routes
  // stayed in use while the next stop's lookup ran, and a notice for a
  // route that never serves the new stop appeared under it.
  const [served, setServed] = useState({ stopId: "", ids: EMPTY_ROUTE_IDS });
  const servedRouteIds =
    served.stopId === stopId ? served.ids : EMPTY_ROUTE_IDS;
  const abortRef = useRef(null);
  const membershipAbortRef = useRef(null);
  // Föli writes its notices in Finnish and translates them into Swedish and
  // English; which one shows follows the interface (providerLanguages). A
  // change of language also re-extracts the alerts' own labels.
  const language = useLanguage();
  const preferredLanguages = useMemo(
    () => providerLanguages(language),
    [language]
  );

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
      setServed({ stopId, ids: EMPTY_ROUTE_IDS });
      return () => controller.abort();
    }

    fetchStopServedRouteIds(stopId, candidateRouteIds, controller.signal)
      .then((routeIds) => {
        if (!controller.signal.aborted) setServed({ stopId, ids: routeIds });
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          // Realtime line matching still provides a safe partial fallback.
          setServed({ stopId, ids: EMPTY_ROUTE_IDS });
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
    // Started offline, or after one failed check, the notices waited up to
    // five minutes after the connection came back, and live departures
    // showed without their cancellations in the meantime.
    const handleOnline = () => refresh();

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("online", handleOnline);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("online", handleOnline);
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
