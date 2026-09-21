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
    instruction: "The alert repeats until the ride is finished or tracking moves on.",
  },
  [RIDE_STAGE.MISSED]: {
    eyebrow: "Recovery",
    title: "Your stop may be behind you",
    instruction: "Get off at the next stop and use the recovery action below.",
  },
};

function etaLabel(seconds) {
  const value = Number(seconds);
  if (!Number.isFinite(value)) return "";
  if (value <= 30) return "about now";
  const minutes = Math.max(1, Math.ceil(value / 60));
  return `~${minutes} min`;
}

function remainingLabel(value) {
  const count = Number(value);
  if (!Number.isFinite(count)) return "";
  if (count <= 0) return "target stop";
  return `${count} ${count === 1 ? "stop" : "stops"}`;
}

function trackingLabel(health) {
  if (health === "live") return "Live tracking";
  if (health === "delayed") return "Live tracking delayed";
  return "Schedule fallback";
}

function gpsDetail(gps) {
  if (Number.isFinite(Number(gps.routeDistanceM))) {
    return `~${Math.max(0, Math.round(gps.routeDistanceM))} m along route`;
  }
  if (Number.isFinite(Number(gps.distanceM))) {
    return `~${Math.round(gps.distanceM)} m straight-line fallback`;
  }
  return "coordinates are never stored";
}

function locationLabel(gps, enabled) {
  if (!enabled) return "GPS ride tracking off";
  if (gps.status === "off-route") return "GPS no longer matches this trip";
  if (gps.status === "active" && gps.shapeUsable && gps.onRoute) {
    return "GPS matched to trip path";
  }
  if (gps.status === "active") return "GPS fallback active";
  if (gps.status === "weak") return "GPS accuracy is weak";
  if (gps.status === "starting") return "Starting GPS ride tracking";
  if (gps.status === "error") return "GPS ride tracking unavailable";
  if (gps.status === "unavailable") return "GPS unsupported";
  return "GPS waiting";
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
  const eta = etaLabel(gps.routeEtaSec ?? runtime.liveEtaSec ?? runtime.scheduleEtaSec);
  const remaining = remainingLabel(runtime.remainingStops);

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

      <div className={styles.statusGrid}>
        <span>
          <strong>{trackingLabel(runtime.trackingHealth)}</strong>
          <small>
            {runtime.targetMatchBy
              ? `matched by ${runtime.targetMatchBy.replaceAll("-", " ")}`
              : "waiting for a matching realtime row"}
          </small>
        </span>
        <span>
          <strong>
            {locationLabel(gps, session.options?.locationBackup === true)}
          </strong>
          <small>{gpsDetail(gps)}</small>
        </span>
        <span>
          <strong>
            {wakeLockState === "active"
              ? "Screen wake lock active"
              : wakeLockState === "unsupported"
                ? "Wake lock unsupported"
                : "Wake lock not active"}
          </strong>
          <small>Most reliable while this page stays open and visible</small>
        </span>
      </div>

      {scheduleOnly && (
        <p className={styles.degraded} role="status">
          Live ride matching is unavailable right now. Early warnings continue
          from the anchored timetable, but Ride Mode will not claim “get off
          now” from schedule alone.
        </p>
      )}

      {gps.error && (
        <p className={styles.degraded} role="status">
          {gps.error} Ride tracking continues without device location.
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
        Client-only Ride Mode is travel assistance, not a guaranteed alarm.
        Browsers can suspend background pages. For the best reliability, keep
        this screen open and sound enabled.
      </p>
    </section>
  );
}
