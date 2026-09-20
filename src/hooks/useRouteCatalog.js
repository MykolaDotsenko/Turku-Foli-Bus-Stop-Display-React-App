import { useEffect, useState } from "react";
import { fetchRouteCatalog } from "../api/foliApi";

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

  useEffect(() => {
    const isFresh =
      cache.savedAt > 0 && Date.now() - cache.savedAt < CACHE_TTL_MS;
    if (isFresh) return undefined;

    const controller = new AbortController();

    fetchRouteCatalog(controller.signal)
      .then((routes) => {
        const next = { routes, savedAt: Date.now() };
        setCache(next);
        persist(next);
      })
      .catch(() => {
        // Keep stale route metadata. Core departures do not depend on it.
      });

    return () => controller.abort();
  }, [cache.savedAt]);

  return cache.routes;
}
