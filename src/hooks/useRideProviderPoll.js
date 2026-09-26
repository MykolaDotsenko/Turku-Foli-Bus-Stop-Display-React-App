import { useEffect } from "react";
import { fetchStopMonitor } from "../api/foliApi";
import { matchRideArrival } from "../utils/rideProgress";
import { ridePollDelayMs } from "../utils/retry";

const REALTIME_ONLY = Object.freeze({ scheduleFallback: false });

// What one stop's answer says about the ride. Only a row the feed is tracking
// is evidence of where the bus is. The feed also lists journeys it is not
// tracking, with the timetable time under the same trip id; counting those as
// sightings showed "Following your bus" and a timetable-timed "Press STOP now"
// just as live tracking was lost. An answer with no rows, NO_SIRI_DATA
// included, means the bus is not in the live data: a stop with nothing more
// coming can answer that way once the bus has left it, and holding the last
// sighting then kept the get-off alarm repeating for the rest of the ride.
function rideSighting(answer, identity) {
  const match = matchRideArrival(answer?.arrivals, identity);
  if (!match) return { kind: "absent" };

  return match.arrival?.monitored === true
    ? { kind: "live", match }
    : { kind: "untracked" };
}

// Föli realtime is the confirmation source that runs independently of the
// phone's own location: it watches the target stop, and the one before it,
// for the journey the passenger actually boarded.
export default function useRideProviderPoll({
  rideId,
  sessionRef,
  runtimeRef,
  rideIdentity,
  readArrivalSignals,
  onRuntime,
}) {
  useEffect(() => {
    if (!rideId) return undefined;

    let active = true;
    let timeoutId = null;
    let controller = null;
    let consecutiveFailures = 0;

    const schedule = () => {
      if (!active) return;
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(
        runPoll,
        ridePollDelayMs(consecutiveFailures)
      );
    };

    async function runPoll() {
      if (!active) return;

      const current = sessionRef.current;
      if (!current) return;

      controller?.abort();
      controller = new AbortController();
      const signal = controller.signal;

      // Counted before the work, so a throw anywhere below still backs off
      // instead of retrying a broken poll at full speed.
      consecutiveFailures += 1;

      try {
        const [targetResult, previousResult] = await Promise.allSettled([
          fetchStopMonitor(current.targetStop.id, signal, REALTIME_ONLY),
          current.previousStop?.id
            ? fetchStopMonitor(current.previousStop.id, signal, REALTIME_ONLY)
            : Promise.resolve(null),
        ]);

        if (!active || signal.aborted) return;

        const before = runtimeRef.current;
        const next = { ...before, lastPollAt: Date.now(), lastError: "" };
        const identity = rideIdentity(current);

        if (targetResult.status === "fulfilled") {
          consecutiveFailures = 0;
          next.lastProviderSuccessAt = Date.now();

          const target = rideSighting(targetResult.value, identity);

          if (target.kind === "live") {
            const targetMatch = target.match;
            next.targetListed = true;
            next.targetMatchBy = targetMatch.matchedBy;
            next.lastLiveMatchAt = Date.now();
            next.targetMissingCount = 0;
            next.targetWasAtStop =
              next.targetWasAtStop ||
              targetMatch.arrival.vehicleatstop === true;
            Object.assign(
              next,
              readArrivalSignals(
                targetMatch.arrival,
                targetResult.value.serverTime,
                current.targetStop
              )
            );
          } else {
            // Absent, or listed without tracking: either way the bus is not
            // in the live data.
            next.targetListed = false;
            next.targetMatchBy = "";
            next.targetMissingCount =
              before.targetListed ||
              before.targetMissingCount > 0 ||
              before.targetWasAtStop
                ? before.targetMissingCount + 1
                : 0;
            next.liveEtaSec = null;
            next.providerDistanceM = null;
            next.providerPositionAgeSec = null;
          }
        } else {
          next.lastError =
            "Live target-stop tracking is temporarily unavailable.";
        }

        if (previousResult.status === "fulfilled" && previousResult.value) {
          next.lastProviderSuccessAt = Date.now();
          const previous = rideSighting(previousResult.value, identity);

          if (previous.kind === "live") {
            next.lastLiveMatchAt = Date.now();
            next.previousSeen = true;
            next.previousMissingCount = 0;
          } else if (previous.kind === "untracked") {
            // An untracked row leaves the board when its timetable time
            // passes, bus or no bus, so its disappearance cannot mean the bus
            // left. Only a fresh live sighting re-arms that check.
            next.previousSeen = false;
            next.previousMissingCount = 0;
          } else if (previous.kind === "absent" && before.previousSeen) {
            next.previousMissingCount = before.previousMissingCount + 1;
          }
        } else if (previousResult.status === "rejected") {
          next.lastError =
            next.lastError ||
            "Previous-stop tracking is temporarily unavailable.";
        }

        onRuntime(next);
      } catch {
        // Everything the network can do is already absorbed by allSettled
        // above, so a throw here is a defect rather than an outage. It must
        // not escape as an unhandled rejection — nobody awaits this call —
        // and it must not end the ride: the panel keeps the state it had and
        // the next round is still booked below.
      } finally {
        // The next poll used to be booked only on the happy path, so one
        // unexpected throw ended live tracking for the rest of the ride with
        // nothing on screen to say so. A superseded poll still stays quiet:
        // the newer one owns the timer.
        if (active && !signal.aborted) schedule();
      }
    }

    const handleVisible = () => {
      if (document.visibilityState === "visible") {
        window.clearTimeout(timeoutId);
        void runPoll();
      }
    };

    const handleOnline = () => {
      // The gap that caused the backoff is over, so start the cadence again.
      consecutiveFailures = 0;
      window.clearTimeout(timeoutId);
      void runPoll();
    };

    void runPoll();
    document.addEventListener("visibilitychange", handleVisible);
    window.addEventListener("online", handleOnline);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
      controller?.abort();
      document.removeEventListener("visibilitychange", handleVisible);
      window.removeEventListener("online", handleOnline);
    };
  }, [
    onRuntime,
    readArrivalSignals,
    rideId,
    rideIdentity,
    runtimeRef,
    sessionRef,
  ]);
}
