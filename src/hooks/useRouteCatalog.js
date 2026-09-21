import { useEffect, useState } from "react";
import { fetchRouteCatalog } from "../api/foliApi";
import useRetrySignal from "./useRetrySignal";

const CACHE_KEY = "foli-route-catalog-v1";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function readCache() {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY));
    if (Array.isArray(cached?.routes)) {
      return {
        routes: cached.routes,
        savedAt: Number(cached.savedAt) || 0,
      };
    }
  } catch {
    // Route metadata is progressive enhancement.
  }

  return { routes: [], savedAt: 0 };
}

function persist(next) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(next));
  } catch {
    // Storage is an optimization, not a requirement.
  }
}

export default function useRouteCatalog() {
  const [cache, setCache] = useState(readCache);
  const { attempt, reportFailure, reportSuccess } = useRetrySignal();
  // Evaluated per render, so a session that outlives the cache refreshes
  // instead of serving day-old route metadata until someone reloads.
  const isFresh =
    cache.savedAt > 0 && Date.now() - cache.savedAt < CACHE_TTL_MS;

  useEffect(() => {
    if (isFresh) return undefined;

    const controller = new AbortController();

    fetchRouteCatalog(controller.signal)
      .then((routes) => {
        if (controller.signal.aborted) return;

        const next = { routes, savedAt: Date.now() };
        reportSuccess();
        setCache(next);
        persist(next);
      })
      .catch(() => {
        if (controller.signal.aborted) return;

        // Keep stale route metadata and retry. Core departures never depend
        // on it, but line colours and names stay wrong until it lands.
        reportFailure();
      });

    return () => controller.abort();
  }, [attempt, isFresh, reportFailure, reportSuccess]);

  return cache.routes;
}
