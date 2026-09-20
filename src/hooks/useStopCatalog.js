import { useEffect, useState } from "react";
import { fetchStopCatalog } from "../api/foliApi";

const CACHE_KEY = "foli-stop-catalog-v2";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function readCache() {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY));
    if (Array.isArray(cached?.stops)) {
      return {
        stops: cached.stops,
        savedAt: Number(cached.savedAt) || 0,
      };
    }
  } catch {
    // Suggestions are optional; direct stop lookup still works.
  }

  return { stops: [], savedAt: 0 };
}

export default function useStopCatalog() {
  const [cache, setCache] = useState(readCache);

  useEffect(() => {
    const isFresh =
      cache.savedAt > 0 && Date.now() - cache.savedAt < CACHE_TTL_MS;

    if (isFresh) return undefined;

    const controller = new AbortController();

    fetchStopCatalog(controller.signal)
      .then((nextStops) => {
        const next = { savedAt: Date.now(), stops: nextStops };
        setCache(next);

        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(next));
        } catch {
          // Storage is an optimization, not a requirement.
        }
      })
      .catch(() => {
        // Keep an expired cached catalogue as a stale-while-revalidate fallback.
      });

    return () => controller.abort();
  }, [cache.savedAt]);

  return cache.stops;
}
