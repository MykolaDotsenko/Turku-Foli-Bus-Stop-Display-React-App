import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { retryDelayMs } from "../utils/retry";

function documentIsVisible() {
  return (
    typeof document === "undefined" || document.visibilityState === "visible"
  );
}

/**
 * Drives recovery for a resource that is otherwise loaded once per page view.
 *
 * Consumers add `attempt` to their effect dependencies, then call
 * `reportSuccess` or `reportFailure` when the request settles. A failed load
 * is retried with a bounded exponential backoff, and immediately when the
 * browser regains connectivity or the tab becomes visible again, so a single
 * network blip at startup cannot degrade a feature for the whole session.
 *
 * Retries only run while the document is visible, so a background tab never
 * creates provider load.
 */
export default function useRetrySignal() {
  const [attempt, setAttempt] = useState(0);
  const consecutiveFailuresRef = useRef(0);
  const retryPendingRef = useRef(false);
  const timeoutRef = useRef(null);

  const clearRetryTimer = useCallback(() => {
    if (timeoutRef.current === null) return;

    window.clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  }, []);

  const retryNow = useCallback(() => {
    clearRetryTimer();
    if (!retryPendingRef.current || !documentIsVisible()) return;

    retryPendingRef.current = false;
    setAttempt((current) => current + 1);
  }, [clearRetryTimer]);

  const reportFailure = useCallback(() => {
    consecutiveFailuresRef.current += 1;
    retryPendingRef.current = true;
    clearRetryTimer();

    timeoutRef.current = window.setTimeout(
      retryNow,
      retryDelayMs(consecutiveFailuresRef.current)
    );
  }, [clearRetryTimer, retryNow]);

  const reportSuccess = useCallback(() => {
    consecutiveFailuresRef.current = 0;
    retryPendingRef.current = false;
    clearRetryTimer();
  }, [clearRetryTimer]);

  useEffect(() => {
    window.addEventListener("online", retryNow);
    document.addEventListener("visibilitychange", retryNow);

    return () => {
      window.removeEventListener("online", retryNow);
      document.removeEventListener("visibilitychange", retryNow);
      clearRetryTimer();
    };
  }, [clearRetryTimer, retryNow]);

  // Memoized so a caller that spreads this into an effect dependency array
  // cannot re-run that effect on every render.
  return useMemo(
    () => ({ attempt, reportFailure, reportSuccess }),
    [attempt, reportFailure, reportSuccess]
  );
}
