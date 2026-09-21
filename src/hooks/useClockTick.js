import { useEffect, useState } from "react";

/**
 * Re-renders on a slow interval so elapsed-time labels keep counting between
 * provider refreshes. Without it a departure can read "2 min" for the whole
 * 30-second gap between polls.
 *
 * The tick pauses while the tab is hidden and catches up as soon as it is
 * visible again.
 */
export default function useClockTick(intervalMs = 10_000) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const interval = Math.max(1_000, Number(intervalMs) || 0);

    const tick = () => {
      if (document.visibilityState !== "visible") return;
      setNowMs(Date.now());
    };

    const intervalId = window.setInterval(tick, interval);
    document.addEventListener("visibilitychange", tick);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [intervalMs]);

  return nowMs;
}
