import { useEffect, useRef, useState } from "react";
import {
  fetchStopCatalog,
  fetchStopCoordinates,
} from "../api/foliApi";

const CACHE_KEY = "foli-stop-catalog-v2";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function stopHasCoordinates(stop) {
  return (
    Number.isFinite(stop?.lat) &&
    stop.lat >= -90 &&
    stop.lat <= 90 &&
    Number.isFinite(stop?.lon) &&
    stop.lon >= -180 &&
    stop.lon <= 180
  );
}

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

function coordinatesFromStops(stops) {
  return new Map(
    stops
      .filter(stopHasCoordinates)
      .map((stop) => [stop.id, { lat: stop.lat, lon: stop.lon }])
  );
}

function mergeCoordinates(stops, coordinates) {
  return stops.map((stop) => {
    const coordinate = coordinates?.get(stop.id);
    return coordinate ? { ...stop, ...coordinate } : stop;
  });
}

function persistCache(cache) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Storage is an optimization, not a requirement.
  }
}

export default function useStopCatalog() {
  const [cache, setCache] = useState(readCache);
  const initialCache = useRef(cache).current;
  const [coordinatesStatus, setCoordinatesStatus] = useState(() =>
    initialCache.stops.some(stopHasCoordinates) ? "ready" : "loading"
  );

  useEffect(() => {
    const controller = new AbortController();
    const isFresh =
      initialCache.savedAt > 0 &&
      Date.now() - initialCache.savedAt < CACHE_TTL_MS;
    const cachedCoordinates = coordinatesFromStops(initialCache.stops);
    const hasCachedCoordinates = cachedCoordinates.size > 0;
    let latestCoordinates = hasCachedCoordinates ? cachedCoordinates : null;
    let active = true;

    const save = (nextCache) => {
      if (!active) return;
      setCache(nextCache);
      persistCache(nextCache);
    };

    const shouldRefreshCoordinates = !isFresh || !hasCachedCoordinates;

    if (shouldRefreshCoordinates) {
      fetchStopCoordinates(controller.signal)
        .then((coordinates) => {
          if (!active) return;

          latestCoordinates = coordinates;
          setCoordinatesStatus("ready");
          setCache((current) => {
            const next = {
              ...current,
              stops: mergeCoordinates(current.stops, coordinates),
            };
            persistCache(next);
            return next;
          });
        })
        .catch(() => {
          if (!active || controller.signal.aborted) return;
          setCoordinatesStatus(hasCachedCoordinates ? "ready" : "unavailable");
        });
    }

    if (!isFresh) {
      fetchStopCatalog(controller.signal)
        .then((freshStops) => {
          const coordinates = latestCoordinates || cachedCoordinates;
          const next = {
            savedAt: Date.now(),
            stops: mergeCoordinates(freshStops, coordinates),
          };
          save(next);
        })
        .catch(() => {
          // Keep an expired cached catalogue as a stale-while-revalidate fallback.
        });
    } else if (hasCachedCoordinates) {
      setCoordinatesStatus("ready");
    }

    return () => {
      active = false;
      controller.abort();
    };
  }, [initialCache]);

  return {
    stops: cache.stops,
    coordinatesStatus,
  };
}
