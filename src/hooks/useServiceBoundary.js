import { useEffect, useState } from "react";
import { fetchServiceBoundary } from "../api/foliApi";

const CACHE_KEY = "foli-service-boundary-v1";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function readCache() {
  try {
    const parsed = JSON.parse(localStorage.getItem(CACHE_KEY));
    if (
      parsed?.geometry?.type === "MultiPolygon" &&
      Array.isArray(parsed.geometry.coordinates)
    ) {
      return {
        geometry: parsed.geometry,
        savedAt: Number(parsed.savedAt) || 0,
      };
    }
  } catch {
    // Boundary is progressive enhancement. Fall through to live fetch.
  }

  return { geometry: null, savedAt: 0 };
}

function persist(cache) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Local storage is only a performance optimization.
  }
}

export default function useServiceBoundary() {
  const [cache, setCache] = useState(readCache);
  const [status, setStatus] = useState(() =>
    cache.geometry ? "ready" : "loading"
  );

  useEffect(() => {
    const fresh =
      cache.savedAt > 0 && Date.now() - cache.savedAt < CACHE_TTL_MS;

    if (fresh && cache.geometry) {
      setStatus("ready");
      return undefined;
    }

    const controller = new AbortController();

    fetchServiceBoundary(controller.signal)
      .then((geometry) => {
        const next = { geometry, savedAt: Date.now() };
        setCache(next);
        setStatus("ready");
        persist(next);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setStatus(cache.geometry ? "ready" : "unavailable");
      });

    return () => controller.abort();
  }, [cache.geometry, cache.savedAt]);

  return {
    geometry: cache.geometry,
    status,
  };
}
