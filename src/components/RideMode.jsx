import { useEffect, useRef, useState } from "react";
import { msg, t, useLanguage } from "../i18n";
import { rideExitInstruction } from "../utils/rideInstructions";
import { RIDE_STAGE, rideStageRank } from "../utils/rideProgress";
import styles from "./RideMode.module.css";

const STAGE_COPY = {
  [RIDE_STAGE.BOARDED]: {
    eyebrow: msg("Ride Mode active"),
    title: msg("No need to watch for your stop"),
    instruction: msg("We will warn you as your stop gets closer."),
  },
  [RIDE_STAGE.SOON]: {
    eyebrow: msg("Get ready"),
    title: msg("Your stop is coming up"),
    instruction: msg("Gather your things and get ready to move toward the doors."),
  },
  [RIDE_STAGE.NEXT]: {
    eyebrow: msg("Next stop"),
    title: msg("Your stop is next"),
    instruction: msg("Press the STOP button now."),
  },
  [RIDE_STAGE.NOW]: {
    eyebrow: msg("This is your stop"),
    title: msg("Get off now"),
    instruction: msg("Move to the doors and step off here."),
  },
  [RIDE_STAGE.MISSED]: {
    eyebrow: msg("Recovery"),
    title: msg("Your stop may be behind you"),
    instruction: msg("Get off at the next stop and use the recovery action below."),
  },
};

// Going by the timetable alone, a time well past with the stop still ahead
// means the bus is behind it. The timetable's own count of stops left cannot
// say that: it runs on the same clock, so it read "running late" on time
// and "about now" two minutes late. A live or location estimate is trusted
// as it stands.
const RUNNING_LATE_AFTER_SEC = 30;

function etaLabel(seconds, stage, { source = "" } = {}) {
  if (stage === RIDE_STAGE.NOW) return t("now");
  if (stage === RIDE_STAGE.MISSED) return "";
  if (seconds === null || seconds === undefined || seconds === "") return "";
  const value = Number(seconds);
  if (!Number.isFinite(value)) return "";
  if (value <= 30) {
    return source === "schedule" && value < -RUNNING_LATE_AFTER_SEC
      ? t("running late")
      : t("about now");
  }
  const minutes = Math.max(1, Math.ceil(value / 60));
  return `~${t("{minutes} min", { minutes })}`;
}

function remainingLabel(value, stage) {
  if (stage === RIDE_STAGE.NOW) return t("you are here");
  if (stage === RIDE_STAGE.MISSED) return t("behind you");
  if (value === null || value === undefined || value === "") return "";
  const count = Number(value);
  if (!Number.isFinite(count)) return "";
  if (count <= 0) return t("almost there");
  return count === 1 ? t("1 stop") : t("{count} stops", { count });
}

function trackingLabel(health) {
  if (health === "live") return t("Following your bus");
  // About the data, not the bus: "lagging behind" read as a late bus.
  if (health === "delayed") return t("Live tracking is catching up");
  return t("Going by the timetable");
}

// The row under the badge says what the live data shows, from the same
// evidence the badge uses, so the two cannot disagree: the badge once said
// "Following your bus" over "Looking for your bus", and "Your bus is
// confirmed" outlived the tracking it described.
function liveEvidence(runtime, session) {
  if (runtime.targetLive === true) {
    return {
      title: t("Your bus is confirmed"),
      detail: t("in Föli’s live arrival data"),
    };
  }
  if (runtime.trackingHealth === "live" && runtime.previousSeen === true) {
    return {
      title: t("Your bus is confirmed"),
      detail: session.previousStop?.name
        ? t("on its way to {name}", { name: session.previousStop.name })
        : t("in Föli’s live arrival data"),
    };
  }
  if (runtime.trackingHealth === "delayed") {
    return {
      title: t("Waiting for a live update"),
      detail: t("last seen in Föli’s live data about a minute ago"),
    };
  }
  return {
    title: t("Looking for your bus"),
    detail: t("in Föli’s live arrival data"),
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
    ? t("last seen {minutes} min ago", { minutes })
    : t("last seen over a minute ago");
}

function gpsDetail(gps, enabled, ageSec) {
  if (!enabled) return t("using arrival data only");
  if (gpsIsStale(ageSec)) return staleLabel(ageSec);

  if (
    gps.routeDistanceM !== null &&
    gps.routeDistanceM !== undefined &&
    Number.isFinite(Number(gps.routeDistanceM))
  ) {
    const along = Math.round(Number(gps.routeDistanceM));
    return along < 0
      ? t("about {meters} m past your stop", { meters: Math.abs(along) })
      : t("about {meters} m to go", { meters: along });
  }
  if (
    gps.distanceM !== null &&
    gps.distanceM !== undefined &&
    Number.isFinite(Number(gps.distanceM))
  ) {
    return t("roughly {meters} m away", { meters: Math.round(gps.distanceM) });
  }
  return t("waiting for a location");
}

function locationLabel(gps, enabled, ageSec) {
  if (!enabled) return t("Not using your location");
  if (gpsIsStale(ageSec)) return t("Lost track of your location");
  if (gps.status === "off-route") return t("You may not be on this route");
  if (gps.status === "active" && gps.shapeUsable && gps.onRoute) {
    return t("Following you along the route");
  }
  if (gps.status === "active") return t("Following you, roughly");
  if (gps.status === "weak") return t("Weak location signal");
  if (gps.status === "starting") return t("Finding your location");
  if (gps.status === "error") return t("Cannot use your location");
  if (gps.status === "unavailable") return t("This phone cannot share location");
  return t("Waiting for your location");
}

// Whole sentences rather than pieces: in Finnish the line and the
// destination do not go where they go in English.
function offRouteQuestion({ lineRef, destination }) {
  if (lineRef && destination) {
    return t(
      "For two minutes you have not been moving along line {line} to {destination}. Are you still on this bus?",
      { line: lineRef, destination }
    );
  }
  if (lineRef) {
    return t(
      "For two minutes you have not been moving along line {line}. Are you still on this bus?",
      { line: lineRef }
    );
  }
  if (destination) {
    return t(
      "For two minutes you have not been moving along this route to {destination}. Are you still on this bus?",
      { destination }
    );
  }
  return t(
    "For two minutes you have not been moving along this route. Are you still on this bus?"
  );
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
  // Every word below follows the language, including a switch mid-ride.
  useLanguage();

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
          <p className={styles.eyebrow}>{t(copy.eyebrow)}</p>
          <h2 id="ride-mode-title">{t(copy.title)}</h2>
        </div>
        <span
          className={styles.health}
          data-health={runtime.trackingHealth}
        >
          {trackingLabel(runtime.trackingHealth)}
        </span>
      </div>

      <div className={styles.target}>
        <span>{t("Your stop")}</span>
        <strong>{session.targetStop.name}</strong>
        <small>
          {t("Stop {id}", { id: session.targetStop.id })}
          {afterName ? ` · ${t("after {name}", { name: afterName })}` : ""}
        </small>
      </div>

      {beforeTheApproach && alertHeard !== "yes" && (
        <div
          className={styles.soundCheck}
          role="group"
          aria-label={t("Alert sound check")}
        >
          {alertHeard !== "no" ? (
            <>
              <strong>{t("Did you hear the test alert?")}</strong>
              <div className={styles.soundCheckActions}>
                <button type="button" onClick={() => setAlertHeard("yes")}>
                  {t("Yes")}
                </button>
                <button type="button" onClick={() => setAlertHeard("no")}>
                  {t("No")}
                </button>
              </div>
            </>
          ) : (
            <>
              <strong>{t("Let's get the sound working")}</strong>
              <ul>
                <li>{t("Turn the media volume up.")}</li>
                <li>{t("Switch off silent or focus mode.")}</li>
                <li>{t("Check the sound is not going to other headphones.")}</li>
              </ul>
              <div className={styles.soundCheckActions}>
                <button type="button" onClick={onTestAlert}>
                  {t("Play it again")}
                </button>
                <button type="button" onClick={() => setAlertHeard("yes")}>
                  {t("I can hear it now")}
                </button>
              </div>
              <small>
                {t(
                  "Tracking is already running. Your phone will also vibrate and show a notification."
                )}
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
        {t(copy.instruction)}
      </p>

      <div className={styles.metrics} aria-label={t("Ride progress")}>
        <div>
          <span>{t("Line")}</span>
          <strong>{session.lineRef || "—"}</strong>
        </div>
        <div>
          <span>{t("Remaining")}</span>
          <strong>{remaining || t("tracking")}</strong>
        </div>
        <div>
          <span>{t("Estimate")}</span>
          <strong>{eta || "—"}</strong>
        </div>
      </div>

      {session.stage === RIDE_STAGE.MISSED && session.nextStop && (
        <div className={styles.recovery}>
          <strong>
            {t("Next planned stop: {name}", {
              name: session.nextStop.name ?? "",
            })}
          </strong>
          <button type="button" onClick={recoverAtNextStop}>
            {t("Open next stop")}
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
            {t("I'm getting off")}
          </button>
        ) : (
          <>
            <button
              type="button"
              className={styles.test}
              onClick={onTestAlert}
            >
              {t("Test alert")}
            </button>
            <button type="button" className={styles.end} onClick={onEndRide}>
              {t("End ride")}
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
              ? t("Keeping your screen on")
              : wakeLockState === "unsupported"
                ? t("Cannot keep your screen on")
                : t("Your screen may switch off")}
          </strong>
          <small>
            {t("Most reliable while this page stays open and visible")}
          </small>
        </span>
      </div>
      )}

      {scheduleOnly && (
        <p className={styles.degraded} role="status">
          {t(
            "We cannot see your bus in the live data right now, so we are going by the timetable. You will still get the early warnings, but we will not say “get off now” on the timetable alone."
          )}
        </p>
      )}

      {/* The hook keeps the error as a phrase, translated here. */}
      {gps.error && (
        <p className={styles.degraded} role="status">
          {t(gps.error)} {t("Ride tracking continues without device location.")}
        </p>
      )}

      {gps.offRouteSuspected && offRouteAnsweredFor !== session.id && (
        <div className={styles.offRoute} role="alert">
          <strong>{t("Check your bus")}</strong>
          {/* Telling someone their movement does not match a planned path
              leaves them holding a fact and no move to make. There are only
              two answers, so offer both. */}
          <span>{offRouteQuestion(session)}</span>
          <div className={styles.offRouteActions}>
            <button type="button" onClick={() => setOffRouteAnsweredFor(session.id)}>
              {t("Yes, keep tracking")}
            </button>
            <button type="button" onClick={onEndRide}>
              {t("End ride")}
            </button>
          </div>
        </div>
      )}

      {gps.shapeStatus === "unavailable" &&
        session.options?.locationBackup && (
          <p className={styles.degraded} role="status">
            {t(
              "We could not load this route's path, so we are following your distance to the stop instead. Live arrival data still applies."
            )}
          </p>
        )}



      <p className={styles.boundary}>
        {t(
          "Ride Mode is travel help, not a guaranteed alarm. A browser can pause a page it thinks you have left, so keep this screen open with the sound on."
        )}
      </p>
    </section>
  );
}
