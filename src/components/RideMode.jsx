import { rideExitInstruction } from "../utils/rideInstructions";
import { RIDE_STAGE } from "../utils/rideProgress";
import styles from "./RideMode.module.css";

const STAGE_COPY = {
  [RIDE_STAGE.BOARDED]: {
    eyebrow: "Ride Mode active",
    title: "You can stop watching the map",
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

function etaLabel(seconds, stage) {
  if (stage === RIDE_STAGE.NOW) return "now";
  if (stage === RIDE_STAGE.MISSED) return "";
  if (seconds === null || seconds === undefined || seconds === "") return "";
  const value = Number(seconds);
  if (!Number.isFinite(value)) return "";
  if (value <= 30) return "about now";
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
  if (health === "delayed") return "Your bus is lagging behind";
  return "Going by the timetable";
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
  if (!session) return null;

  const baseStage = STAGE_COPY[session.stage] || STAGE_COPY[RIDE_STAGE.BOARDED];
  const stage = session.stage === RIDE_STAGE.NEXT
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
  const eta = etaLabel(runtime.etaSec, session.stage);
  const remaining = remainingLabel(runtime.remainingStops, session.stage);

  const recoverAtNextStop = () => {
    const nextStopId = session.nextStop?.id;
    onEndRide?.();
    if (nextStopId) onOpenStop?.(nextStopId);
  };

  return (
    <section
      className={styles.panel}
      data-stage={session.stage}
      aria-labelledby="ride-mode-title"
      role="region"
    >
      <div className={styles.topline}>
        <div>
          <p className={styles.eyebrow}>{stage.eyebrow}</p>
          <h2 id="ride-mode-title">{stage.title}</h2>
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

      <p
        className={styles.instruction}
        role={urgent ? "alert" : "status"}
        aria-live={urgent ? "assertive" : "polite"}
      >
        {stage.instruction}
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

      {!gettingOffNow && (
        <div className={styles.statusGrid}>
          <span>
            <strong>
              {runtime.targetMatchBy
                ? "Your bus is confirmed"
                : "Looking for your bus"}
            </strong>
            <small>in Föli&apos;s live arrival data</small>
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

      {gps.offRouteSuspected && (
        <p className={styles.degraded} role="alert">
          You have been off this bus&apos;s route for about two minutes. Check
          that you are on the right vehicle.
        </p>
      )}

      {gps.shapeStatus === "unavailable" &&
        session.options?.locationBackup && (
          <p className={styles.degraded} role="status">
            We could not load this route&apos;s path, so we are following your
            distance to the stop instead. Live arrival data still applies.
          </p>
        )}

      {session.stage === RIDE_STAGE.MISSED && session.nextStop && (
        <div className={styles.recovery}>
          <strong>Next planned stop: {session.nextStop.name}</strong>
          <button type="button" onClick={recoverAtNextStop}>
            Open next stop
          </button>
        </div>
      )}

      <div className={styles.actions}>
        <button type="button" className={styles.test} onClick={onTestAlert}>
          Test alert
        </button>
        {session.stage === RIDE_STAGE.NOW && (
          <button
            type="button"
            className={styles.confirm}
            onClick={onEndRide}
          >
            I&apos;m getting off
          </button>
        )}
        <button type="button" className={styles.end} onClick={onEndRide}>
          End ride
        </button>
      </div>

      <p className={styles.boundary}>
        Ride Mode is travel help, not a guaranteed alarm. A browser can pause
        a page it thinks you have left, so keep this screen open with the
        sound on.
      </p>
    </section>
  );
}
