import { useEffect, useState } from "react";

// Ride Mode is only as reliable as the page staying awake, so the lock is
// re-requested every time the passenger looks at their phone again: the
// browser releases a screen lock whenever the document is hidden, and
// nothing re-takes it on its own.
export default function useRideWakeLock(rideId) {
  const [wakeLockState, setWakeLockState] = useState("inactive");

  useEffect(() => {
    if (!rideId) {
      setWakeLockState("inactive");
      return undefined;
    }

    if (typeof globalThis.navigator?.wakeLock?.request !== "function") {
      setWakeLockState("unsupported");
      return undefined;
    }

    let active = true;
    let sentinel = null;

    const request = async () => {
      if (!active || document.visibilityState !== "visible") return;

      try {
        sentinel = await globalThis.navigator.wakeLock.request("screen");
        if (!active) {
          await sentinel.release?.();
          return;
        }
        setWakeLockState("active");
        sentinel.addEventListener?.("release", () => {
          sentinel = null;
          if (active) setWakeLockState("inactive");
        });
      } catch {
        if (active) setWakeLockState("inactive");
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible" && !sentinel) {
        void request();
      }
    };

    void request();
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      active = false;
      document.removeEventListener("visibilitychange", handleVisibility);
      void sentinel?.release?.();
    };
  }, [rideId]);

  return wakeLockState;
}
