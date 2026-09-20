import { useCallback, useMemo, useState } from "react";

const STORAGE_KEY = "foli-saved-stops-v1";
const MAX_RECENTS = 5;

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

function readStoredState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));

    return {
      favorites: Array.isArray(parsed?.favorites)
        ? parsed.favorites.map(normalizeStop).filter(Boolean)
        : [],
      recents: Array.isArray(parsed?.recents)
        ? parsed.recents.map(normalizeStop).filter(Boolean).slice(0, MAX_RECENTS)
        : [],
    };
  } catch {
    return { favorites: [], recents: [] };
  }
}

function persist(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Saved stops are a convenience; the live departure flow still works.
  }
}

export default function useSavedStops() {
  const [state, setState] = useState(readStoredState);

  const commit = useCallback((updater) => {
    setState((current) => {
      const next = updater(current);
      persist(next);
      return next;
    });
  }, []);

  const rememberRecent = useCallback(
    (stop) => {
      const normalized = normalizeStop(stop);
      if (!normalized) return;

      commit((current) => ({
        ...current,
        recents: [
          normalized,
          ...current.recents.filter((item) => item.id !== normalized.id),
        ].slice(0, MAX_RECENTS),
      }));
    },
    [commit]
  );

  const toggleFavorite = useCallback(
    (stop) => {
      const normalized = normalizeStop(stop);
      if (!normalized) return;

      commit((current) => {
        const exists = current.favorites.some(
          (item) => item.id === normalized.id
        );

        return {
          ...current,
          favorites: exists
            ? current.favorites.filter((item) => item.id !== normalized.id)
            : [...current.favorites, normalized],
        };
      });
    },
    [commit]
  );

  const favoriteIds = useMemo(
    () => new Set(state.favorites.map((stop) => stop.id)),
    [state.favorites]
  );

  return {
    favorites: state.favorites,
    recents: state.recents,
    favoriteIds,
    rememberRecent,
    toggleFavorite,
  };
}
