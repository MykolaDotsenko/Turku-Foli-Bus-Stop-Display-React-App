import { useEffect, useRef, useState } from "react";
import { rideExitInstruction } from "../utils/rideInstructions";
import { RIDE_STAGE, rideStageRank } from "../utils/rideProgress";
import styles from "./RideMode.module.css";

const STAGE_COPY = {
  [RIDE_STAGE.BOARDED]: {
    eyebrow: "Ride Mode active",
    title: "No need to watch for your stop",
    instruction: "We will warn you as your stop gets closer.",
  },
  [RIDE_STAGE.SOON]: {
    eyebrow: "Get ready",
    title: "Your stop is coming up",
    instruction: "Gather your things and get ready to move toward the doors.",
  },
  [RIDE_STAGE.NEXT]: {
    eyebrow: "Next stop",
    title: "Your stop is next",
    instruction: "Press the STOP button now.",
  },
  [RIDE_STAGE.NOW]: {
    eyebrow: "This is your stop",
    title: "Get off now",
    instruction: "Move to the doors and step off here.",
  },
  [RIDE_STAGE.MISSED]: {
    eyebrow: "Recovery",
    title: "Your stop may be behind you",
    instruction: "Get off at the next stop and use the recovery action below.",
  },
};

function etaLabel(seconds, stage, { source = "", remainingStops = null } = {}) {
  if (stage === RIDE_STAGE.NOW) return "now";
  if (stage === RIDE_STAGE.MISSED) return "";
  if (seconds === null || seconds === undefined || seconds === "") return "";
  const value = Number(seconds);
  if (!Number.isFinite(value)) return "";
  if (value <= 30) {
    // The timetable's time for the stop has come but stops remain, so the
    // bus is behind it. A live or location estimate is trusted over the
    // timetable's own count of stops.
    const remaining = Number(remainingStops);
    return source === "schedule" &&
      remainingStops !== null &&
      Number.isFinite(remaining) &&
      remaining > 1
      ? "running late"
      : "about now";
  }
  const minutes = Math.max(1, Math.ceil(value / 60));
  return `~${minutes} min`;
}

function remainingLabel(value, stage) {
  if (stage === RIDE_STAGE.NOW) return "you are here";
  if (stage === RIDE_STAGE.MISSED) return "behind you";
  if (value === null || value === undefined || value === "") return "";
  const count = Number(value);
  if (!Number.isFinite(count)) return "";
  if (count <= 0) return "almost there";
  return `${count} ${count === 1 ? "stop" : "stops"}`;
}

function trackingLabel(health) {
  if (health === "live") return "Following your bus";
  // About the data, not the bus: "lagging behind" read as a late bus.
  if (health === "delayed") return "Live tracking is catching up";
  return "Going by the timetable";
}

// The row under the badge says what the live data shows, from the same
// evidence the badge uses, so the two cannot disagree: the badge once said
// "Following your bus" over "Looking for your bus", and "Your bus is
// confirmed" outlived the tracking it described.
function liveEvidence(runtime, session) {
  if (runtime.targetLive === true) {
    return {
      title: "Your bus is confirmed",
      detail: "in Föli’s live arrival data",
    };
  }
  if (runtime.trackingHealth === "live" && runtime.previousSeen === true) {
    return {
      title: "Your bus is confirmed",
      detail: session.previousStop?.name
        ? `on its way to ${session.previousStop.name}`
        : "in Föli’s live arrival data",
    };
  }
  if (runtime.trackingHealth === "delayed") {
    return {
      title: "Waiting for a live update",
      detail: "last seen in Föli’s live data about a minute ago",
    };
  }
  return {
    title: "Looking for your bus",
    detail: "in Föli’s live arrival data",
  };
}

// The same window the stage logic uses to decide a fix is still evidence.
// Past it the panel must stop presenting the last distance as current: a
// tunnel-old "420 m along route" reads more concrete than the alert badge
// beside it, and a passenger will believe it over the alarm.
const GPS_STALE_AFTER_SEC = 60;

function gpsIsStale(ageSec) {
  const age = Number(ageSec);
  return Number.isFinite(age) && age > GPS_STALE_AFTER_SEC;
}

function staleLabel(ageSec) {
  const minutes = Math.round(Number(ageSec) / 60);
  return minutes >= 2
    ? `last seen ${minutes} min ago`
    : "last seen over a minute ago";
}

function gpsDetail(gps, enabled, ageSec) {
  if (!enabled) return "using arrival data only";
  if (gpsIsStale(ageSec)) return staleLabel(ageSec);

  if (
    gps.routeDistanceM !== null &&
    gps.routeDistanceM !== undefined &&
    Number.isFinite(Number(gps.routeDistanceM))
  ) {
    const along = Math.round(Number(gps.routeDistanceM));
    return along < 0
      ? `about ${Math.abs(along)} m past your stop`
      : `about ${along} m to go`;
  }
  if (
    gps.distanceM !== null &&
    gps.distanceM !== undefined &&
    Number.isFinite(Number(gps.distanceM))
  ) {
    return `roughly ${Math.round(gps.distanceM)} m away`;
  }
  return "waiting for a location";
}

function locationLabel(gps, enabled, ageSec) {
  if (!enabled) return "Not using your location";
  if (gpsIsStale(ageSec)) return "Lost track of your location";
  if (gps.status === "off-route") return "You may not be on this route";
  if (gps.status === "active" && gps.shapeUsable && gps.onRoute) {
    return "Following you along the route";
  }
  if (gps.status === "active") return "Following you, roughly";
  if (gps.status === "weak") return "Weak location signal";
  if (gps.status === "starting") return "Finding your location";
  if (gps.status === "error") return "Cannot use your location";
  if (gps.status === "unavailable") return "This phone cannot share location";
  return "Waiting for your location";
}

export default function RideMode({
  session,
  runtime,
  gps,
  wakeLockState,
  onTestAlert,
  onEndRide,
  onOpenStop,
}) {
  // Declared before the early return: hooks cannot sit behind a condition.
  // Keyed by ride id so a "yes, I'm on this bus" never carries into the next
  // journey, while the same journey stops nagging once answered.
  const [offRouteAnsweredFor, setOffRouteAnsweredFor] = useState("");

  // The whole promise is "you will hear me". Nothing in a web page can see a
  // silent switch, a muted volume, or sound routed to headphones left at
  // home — so the only honest check is to ask. It runs during BOARDED, while
  // the stop is still far off, rather than blocking the start of tracking.
  const [alertHeard, setAlertHeard] = useState("unasked");

  // On a phone the panel scrolls with the page, so a passenger reading the
  // board below it would miss "Press STOP" and "Get off now" on screen. The
  // alerts escalate, so the panel comes back into view with them, unless it
  // is already there.
  const panelRef = useRef(null);
  const stage = session?.stage;
  useEffect(() => {
    if (
      stage !== RIDE_STAGE.NEXT &&
      stage !== RIDE_STAGE.NOW &&
      stage !== RIDE_STAGE.MISSED
    ) {
      return;
    }

    const panel = panelRef.current;
    const box = panel?.getBoundingClientRect?.();
    const viewportHeight = globalThis.innerHeight || 0;
    if (!box || (box.top >= 0 && box.top < viewportHeight * 0.5)) return;

    const calm = globalThis.matchMedia?.(
      "(prefers-reduced-motion: reduce)"
    )?.matches;
    panel.scrollIntoView?.({
      block: "start",
      behavior: calm ? "auto" : "smooth",
    });
  }, [stage]);

  if (!session) return null;

  const baseStage = STAGE_COPY[session.stage] || STAGE_COPY[RIDE_STAGE.BOARDED];
  const copy = session.stage === RIDE_STAGE.NEXT
    ? { ...baseStage, instruction: rideExitInstruction(session.routeType).nextText }
    : baseStage;
  const urgent =
    session.stage === RIDE_STAGE.NEXT ||
    session.stage === RIDE_STAGE.NOW ||
    session.stage === RIDE_STAGE.MISSED;
  const scheduleOnly = runtime.trackingHealth === "schedule";
  const afterName = session.previousStop?.name || session.boardingStop?.name;
  // Measured at 735px on a 360x640 phone, which puts the one button that
  // matters below the fold at the exact moment the alarm is going. The three
  // status rows are 185px of diagnostics — what is being tracked, whether
  // the screen is held awake — and none of it is a decision the passenger
  // makes while standing up to leave. The health badge stays in the corner,
  // and a genuine problem still raises its own banner below.
  const gettingOffNow = session.stage === RIDE_STAGE.NOW;
  // A short hop across town reaches SOON within a stop or two, so tying the
  // sound check to BOARDED alone would hide it on exactly the rides where
  // there is least time to notice a muted phone. It runs until the approach
  // begins, and never during it.
  const beforeTheApproach =
    rideStageRank(session.stage) < rideStageRank(RIDE_STAGE.NEXT);
  const eta = etaLabel(runtime.etaSec, session.stage, {
    source: runtime.etaSource,
    remainingStops: runtime.remainingStops,
  });
  const evidence = liveEvidence(runtime, session);
  const remaining = remainingLabel(runtime.remainingStops, session.stage);

  const recoverAtNextStop = () => {
    const nextStopId = session.nextStop?.id;
    onEndRide?.();
    if (nextStopId) onOpenStop?.(nextStopId);
  };

  return (
    <section
      ref={panelRef}
      className={styles.panel}
      data-stage={session.stage}
      aria-labelledby="ride-mode-title"
      role="region"
    >
      <div className={styles.topline}>
        <div>
          <p className={styles.eyebrow}>{copy.eyebrow}</p>
          <h2 id="ride-mode-title">{copy.title}</h2>
        </div>
        <span
          className={styles.health}
          data-health={runtime.trackingHealth}
        >
          {trackingLabel(runtime.trackingHealth)}
        </span>
      </div>

      <div className={styles.target}>
        <span>Your stop</span>
        <strong>{session.targetStop.name}</strong>
        <small>
          Stop {session.targetStop.id}
          {afterName ? ` · after ${afterName}` : ""}
        </small>
      </div>

      {beforeTheApproach && alertHeard !== "yes" && (
        <div className={styles.soundCheck} role="group" aria-label="Alert sound check">
          {alertHeard !== "no" ? (
            <>
              <strong>Did you hear the test alert?</strong>
              <div className={styles.soundCheckActions}>
                <button type="button" onClick={() => setAlertHeard("yes")}>
                  Yes
                </button>
                <button type="button" onClick={() => setAlertHeard("no")}>
                  No
                </button>
              </div>
            </>
          ) : (
            <>
              <strong>Let&apos;s get the sound working</strong>
              <ul>
                <li>Turn the media volume up.</li>
                <li>Switch off silent or focus mode.</li>
                <li>Check the sound is not going to other headphones.</li>
              </ul>
              <div className={styles.soundCheckActions}>
                <button type="button" onClick={onTestAlert}>
                  Play it again
                </button>
                <button type="button" onClick={() => setAlertHeard("yes")}>
                  I can hear it now
                </button>
              </div>
              <small>
                Tracking is already running. Your phone will also vibrate and
                show a notification.
              </small>
            </>
          )}
        </div>
      )}

      <p
        className={styles.instruction}
        role={urgent ? "alert" : "status"}
        aria-live={urgent ? "assertive" : "polite"}
      >
        {copy.instruction}
      </p>

      <div className={styles.metrics} aria-label="Ride progress">
        <div>
          <span>Line</span>
          <strong>{session.lineRef || "—"}</strong>
        </div>
        <div>
          <span>Remaining</span>
          <strong>{remaining || "tracking"}</strong>
        </div>
        <div>
          <span>Estimate</span>
          <strong>{eta || "—"}</strong>
        </div>
      </div>

      {session.stage === RIDE_STAGE.MISSED && session.nextStop && (
        <div className={styles.recovery}>
          <strong>Next planned stop: {session.nextStop.name}</strong>
          <button type="button" onClick={recoverAtNextStop}>
            Open next stop
          </button>
        </div>
      )}

      {/* Straight under the numbers, above the diagnostics: pinned below a
          panel taller than a small phone, these could not be reached at
          all. At the stop, "I'm getting off" is the only way out; a second
          button doing the same thing is a choice nobody has time for. */}
      <div className={styles.actions}>
        {gettingOffNow ? (
          <button
            type="button"
            className={styles.confirm}
            onClick={onEndRide}
          >
            I&apos;m getting off
          </button>
        ) : (
          <>
            <button
              type="button"
              className={styles.test}
              onClick={onTestAlert}
            >
              Test alert
            </button>
            <button type="button" className={styles.end} onClick={onEndRide}>
              End ride
            </button>
          </>
        )}
      </div>

      {!gettingOffNow && (
        <div className={styles.statusGrid}>
          <span>
            <strong>{evidence.title}</strong>
            <small>{evidence.detail}</small>
          </span>
          <span>
            <strong>
              {locationLabel(
                gps,
                session.options?.locationBackup === true,
                runtime.gpsAgeSec
            )}
          </strong>
          <small>
            {gpsDetail(
              gps,
              session.options?.locationBackup === true,
              runtime.gpsAgeSec
            )}
          </small>
        </span>
        <span>
          <strong>
            {wakeLockState === "active"
              ? "Keeping your screen on"
              : wakeLockState === "unsupported"
                ? "Cannot keep your screen on"
                : "Your screen may switch off"}
          </strong>
          <small>Most reliable while this page stays open and visible</small>
        </span>
      </div>
      )}

      {scheduleOnly && (
        <p className={styles.degraded} role="status">
          We cannot see your bus in the live data right now, so we are going by
          the timetable. You will still get the early warnings, but we will not
          say “get off now” on the timetable alone.
        </p>
      )}

      {gps.error && (
        <p className={styles.degraded} role="status">
          {gps.error} Ride tracking continues without device location.
        </p>
      )}

      {gps.offRouteSuspected && offRouteAnsweredFor !== session.id && (
        <div className={styles.offRoute} role="alert">
          <strong>Check your bus</strong>
          {/* Telling someone their movement does not match a planned path
              leaves them holding a fact and no move to make. There are only
              two answers, so offer both. */}
          <span>
            For two minutes you have not been moving along
            {session.lineRef ? ` line ${session.lineRef}` : " this route"}
            {session.destination ? ` to ${session.destination}` : ""}. Are you
            still on this bus?
          </span>
          <div className={styles.offRouteActions}>
            <button type="button" onClick={() => setOffRouteAnsweredFor(session.id)}>
              Yes, keep tracking
            </button>
            <button type="button" onClick={onEndRide}>
              End ride
            </button>
          </div>
        </div>
      )}

      {gps.shapeStatus === "unavailable" &&
        session.options?.locationBackup && (
          <p className={styles.degraded} role="status">
            We could not load this route&apos;s path, so we are following your
            distance to the stop instead. Live arrival data still applies.
          </p>
        )}



      <p className={styles.boundary}>
        Ride Mode is travel help, not a guaranteed alarm. A browser can pause
        a page it thinks you have left, so keep this screen open with the
        sound on.
      </p>
    </section>
  );
}
