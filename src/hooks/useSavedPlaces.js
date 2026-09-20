import { useCallback, useMemo, useState } from "react";

const STORAGE_KEY = "foli-my-places-v1";
const VALIDATION_WRITE_DEDUP_MS = 60_000;

export const PLACE_PRESETS = [
  { id: "home", label: "Home", icon: "⌂" },
  { id: "school", label: "School", icon: "▣" },
  { id: "work", label: "Work", icon: "▤" },
];

function normalizeStop(stop) {
  if (!stop || typeof stop !== "object") return null;

  const id = String(stop.id || "").trim();
  const name = String(stop.name || "").trim();

  if (!/^\d+$/.test(id)) return null;

  return {
    id,
    name: name || `Stop ${id}`,
  };
}

function normalizePlace(place) {
  if (!place || typeof place !== "object") return null;

  const preset = PLACE_PRESETS.find((candidate) => candidate.id === place.id);
  if (!preset) return null;

  const stops = Array.isArray(place.stops)
    ? place.stops.map(normalizeStop).filter(Boolean).slice(0, 3)
    : [];

  if (stops.length === 0) return null;

  const primaryStopId = stops.some(
    (stop) => stop.id === String(place.primaryStopId || "")
  )
    ? String(place.primaryStopId)
    : stops[0].id;

  return {
    ...preset,
    stops,
    primaryStopId,
    updatedAt: Number(place.updatedAt) || 0,
    validatedAt: Number(place.validatedAt) || 0,
    needsReview: place.needsReview === true,
  };
}

function readStoredPlaces() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(parsed)
      ? parsed.map(normalizePlace).filter(Boolean)
      : [];
  } catch {
    return [];
  }
}

function persist(places) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(places));
  } catch {
    // Places are a convenience. Core departure browsing remains available.
  }
}

export default function useSavedPlaces() {
  const [places, setPlaces] = useState(readStoredPlaces);

  const commit = useCallback((updater) => {
    setPlaces((current) => {
      const next = updater(current);
      if (next === current) return current;
      persist(next);
      return next;
    });
  }, []);

  const savePlace = useCallback(
    ({ id, stops, primaryStopId }) => {
      const preset = PLACE_PRESETS.find((candidate) => candidate.id === id);
      if (!preset) return;

      const normalizedStops = Array.isArray(stops)
        ? stops.map(normalizeStop).filter(Boolean).slice(0, 3)
        : [];

      if (normalizedStops.length === 0) return;

      const resolvedPrimary = normalizedStops.some(
        (stop) => stop.id === String(primaryStopId || "")
      )
        ? String(primaryStopId)
        : normalizedStops[0].id;

      const nextPlace = {
        ...preset,
        stops: normalizedStops,
        primaryStopId: resolvedPrimary,
        updatedAt: Date.now(),
        validatedAt: 0,
        needsReview: false,
      };

      commit((current) => [
        ...current.filter((place) => place.id !== id),
        nextPlace,
      ]);
    },
    [commit]
  );

  const revalidatePlaces = useCallback(
    (catalogStops) => {
      if (!Array.isArray(catalogStops) || catalogStops.length === 0) return;

      const catalogById = new Map(
        catalogStops
          .filter((stop) => stop?.id)
          .map((stop) => [String(stop.id), stop])
      );
      const validatedAt = Date.now();

      commit((current) => {
        if (current.length === 0) return current;

        let changed = false;
        const next = current.map((place) => {
          let needsReview = false;
          let renamed = false;

          const stops = place.stops.map((savedStop) => {
            const currentStop = catalogById.get(savedStop.id);
            if (!currentStop) {
              needsReview = true;
              return savedStop;
            }

            const currentName = String(currentStop.name || "").trim();
            if (currentName && currentName !== savedStop.name) {
              renamed = true;
              return { id: savedStop.id, name: currentName };
            }

            return savedStop;
          });

          if (
            place.needsReview === needsReview &&
            !renamed &&
            validatedAt - place.validatedAt < VALIDATION_WRITE_DEDUP_MS
          ) {
            return place;
          }

          changed = true;
          return {
            ...place,
            stops,
            validatedAt,
            needsReview,
          };
        });

        return changed ? next : current;
      });
    },
    [commit]
  );

  const removePlace = useCallback(
    (id) => {
      commit((current) => current.filter((place) => place.id !== id));
    },
    [commit]
  );

  const setPrimaryStop = useCallback(
    (placeId, stopId) => {
      commit((current) =>
        current.map((place) =>
          place.id === placeId &&
          place.stops.some((stop) => stop.id === String(stopId))
            ? { ...place, primaryStopId: String(stopId), updatedAt: Date.now() }
            : place
        )
      );
    },
    [commit]
  );

  const byId = useMemo(
    () => new Map(places.map((place) => [place.id, place])),
    [places]
  );

  return {
    places,
    byId,
    savePlace,
    revalidatePlaces,
    removePlace,
    setPrimaryStop,
  };
}
