const DEFAULT_MAX_ENTRIES = 50;

/**
 * Least-recently-used cache for provider responses that would otherwise grow
 * without bound in a long-running session, such as a stop display left open
 * for days.
 */
export default function createBoundedCache(maxEntries = DEFAULT_MAX_ENTRIES) {
  const limit = Math.max(1, Math.floor(Number(maxEntries) || 0) || 1);
  const entries = new Map();

  return {
    has(key) {
      return entries.has(key);
    },

    get(key) {
      if (!entries.has(key)) return undefined;

      // Re-insert so the most recently read key is evicted last.
      const value = entries.get(key);
      entries.delete(key);
      entries.set(key, value);
      return value;
    },

    set(key, value) {
      entries.delete(key);
      entries.set(key, value);

      while (entries.size > limit) {
        entries.delete(entries.keys().next().value);
      }

      return value;
    },

    clear() {
      entries.clear();
    },

    get size() {
      return entries.size;
    },
  };
}
