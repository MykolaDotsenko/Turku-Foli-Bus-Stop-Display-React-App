import { useEffect, useState } from "react";
import { fetchStopCatalog } from "../api/foliApi";

const CACHE_KEY = "foli-stop-catalog-v1";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function readCache() {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY));
    if (
      cached?.savedAt &&
      Date.now() - cached.savedAt < CACHE_TTL_MS &&
      Array.isArray(cached.stops)
    ) {
      return cached.stops;
    }
  } catch {
    // Ignore invalid or unavailable storage.
  }
  return null;
}

export default function useStopCatalog() {
  const [stops, setStops] = useState(() => readCache() || []);
  const [loadingStops, setLoadingStops] = useState(stops.length === 0);

  useEffect(() => {
    if (stops.length > 0) return undefined;

    const controller = new AbortController();

    fetchStopCatalog(controller.signal)
      .then((nextStops) => {
        setStops(nextStops);
        try {
          localStorage.setItem(
            CACHE_KEY,
            JSON.stringify({ savedAt: Date.now(), stops: nextStops })
          );
        } catch {
          // The app still works if storage is disabled.
        }
      })
      .catch(() => {
        // Stop-number lookup remains fully usable without the catalog.
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingStops(false);
      });

    return () => controller.abort();
  }, [stops.length]);

  return { stops, loadingStops };
}
