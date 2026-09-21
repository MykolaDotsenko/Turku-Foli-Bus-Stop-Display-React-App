import { useEffect, useMemo, useState } from "react";
import { fetchTripDetails, fetchTripStopTimes } from "../api/foliApi";
import {
  buildRidePlan,
  resolveRideBoardingIndex,
} from "../utils/rideProgress";
import { formatClock, getDepartureTime } from "../utils/time";
import styles from "./RideSetup.module.css";

function plannedClock(value) {
  if (typeof value !== "string") return "";
  const match = value.match(/^(\d{1,3}):(\d{2}):\d{2}$/);
  if (!match) return "";

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || minute > 59) {
    return "";
  }

  return `${String(hour % 24).padStart(2, "0")}:${String(minute).padStart(
    2,
    "0"
  )}`;
}

// "route point 900 m" was `shape_dist_traveled` straight out of GTFS. What a
// passenger actually wants from a list of stop names is how far along the
// ride each one is, so that is what this says instead.
function stopsAwayLabel(count) {
  const stops = Number(count);
  if (!Number.isFinite(stops) || stops <= 1) return "Next stop";
  return `${stops} stops away`;
}

function stopName(stopsById, stopId) {
  return (
    stopsById?.get?.(String(stopId))?.name || `Stop ${stopId}`
  );
}

function savedPlaceLabels(placesById, stopId) {
  if (!(placesById instanceof Map)) return [];

  return [...placesById.values()]
    .filter((place) =>
      place?.stops?.some((stop) => String(stop.id) === String(stopId))
    )
    .map((place) => place.label)
    .filter(Boolean);
}

export default function RideSetup({
  arrival,
  currentStopId,
  currentStopName,
  stopsById,
  placesById,
  routesById,
  onStart,
  onCancel,
}) {
  const [status, setStatus] = useState("loading");
  const [stopTimes, setStopTimes] = useState([]);
  const [tripDetails, setTripDetails] = useState(null);
  const [targetStopSequence, setTargetStopSequence] = useState("");
  const [locationBackup, setLocationBackup] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [startError, setStartError] = useState("");

  useEffect(() => {
    if (!arrival?.tripref) {
      setStatus("error");
      return undefined;
    }

    const controller = new AbortController();
    setStatus("loading");

    Promise.all([
      fetchTripStopTimes(arrival.tripref, controller.signal),
      fetchTripDetails(arrival.tripref, controller.signal).catch(() => null),
    ])
      .then(([items, details]) => {
        if (controller.signal.aborted) return;
        setStopTimes(items);
        setTripDetails(details);
        setStatus("ready");
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatus("error");
      });

    return () => controller.abort();
  }, [arrival?.tripref]);

  const boardingIndex = useMemo(
    () =>
      resolveRideBoardingIndex(
        stopTimes,
        currentStopId,
        arrival?.aimeddeparturetime
      ),
    [arrival?.aimeddeparturetime, currentStopId, stopTimes]
  );

  const downstream = useMemo(() => {
    if (boardingIndex < 0) return [];

    // Counted against the unfiltered trip, because the bus stops at every
    // row whether or not passengers may alight there. Counting the filtered
    // list would put "after X" one stop out whenever a no-drop-off stop sits
    // between two choices, and disagree with the panel shown during the ride.
    return stopTimes
      .map((item, index) => ({ item, index }))
      .filter(
        ({ item, index }) =>
          index > boardingIndex && Number(item.dropOffType) !== 1
      )
      .map(({ item, index }) => ({
        ...item,
        stop: stopsById.get(String(item.stopId)) || {
          id: String(item.stopId),
          name: `Stop ${item.stopId}`,
        },
        places: savedPlaceLabels(placesById, item.stopId),
        stopsAway: index - boardingIndex,
        previousStopName:
          index - 1 === boardingIndex
            ? currentStopName
            : stopName(stopsById, stopTimes[index - 1]?.stopId),
      }));
  }, [boardingIndex, currentStopName, placesById, stopTimes, stopsById]);

  useEffect(() => {
    if (targetStopSequence || downstream.length === 0) return;

    const home = downstream.find((item) => item.places.includes("Home"));
    if (home) setTargetStopSequence(String(home.stopSequence));
  }, [downstream, targetStopSequence]);

  const start = () => {
    const departureEpochSec = getDepartureTime(arrival);
    const selectedTarget = downstream.find(
      (item) => String(item.stopSequence) === String(targetStopSequence)
    );

    // Returning quietly here leaves an enabled button that does nothing when
    // pressed, on the one action the whole feature hangs on.
    if (!selectedTarget) {
      setStartError(
        "Choose the stop you want to get off at before starting Ride Mode."
      );
      return;
    }

    if (!departureEpochSec) {
      setStartError(
        "We do not have a departure time for this bus yet. Wait for the board to refresh and try again."
      );
      return;
    }

    const plan = buildRidePlan({
      stopTimes,
      currentStopId,
      currentStopAimedEpochSec: arrival.aimeddeparturetime,
      targetStopId: selectedTarget.stopId,
      targetStopSequence: selectedTarget.stopSequence,
      stopsById,
      departureEpochSec,
    });
    if (!plan) {
      setStartError(
        "We cannot work out a reliable plan for that stop on this trip. Try another stop, or start the ride from a different departure."
      );
      return;
    }

    setStartError("");

    const exactRoute =
      tripDetails?.routeId && routesById instanceof Map
        ? routesById.get(tripDetails.routeId) || null
        : null;

    onStart?.({
      lineRef: arrival.lineref || "",
      destination:
        arrival.destinationdisplay ||
        arrival.destinationdisplay_en ||
        arrival.destinationdisplay_sv ||
        "",
      tripRef: arrival.tripref || "",
      datedVehicleJourneyRef: arrival.datedvehiclejourneyref || "",
      vehicleRef: arrival.vehicleref || "",
      originAimedDepartureTime: arrival.originaimeddeparturetime || null,
      routeId: tripDetails?.routeId || "",
      routeType: exactRoute?.type ?? null,
      shapeId: tripDetails?.shapeId || "",
      boardingStop: plan.boardingStop,
      targetStop: plan.targetStop,
      previousStop: plan.previousStop,
      nextStop: plan.nextStop,
      plan,
      options: {
        locationBackup,
        notifications,
      },
    });
  };

  const ambiguousBoarding =
    status === "ready" &&
    stopTimes.some(
      (item) => String(item.stopId) === String(currentStopId)
    ) &&
    boardingIndex < 0;

  return (
    <section className={styles.panel} aria-label="Set up get-off alerts">
      <div className={styles.heading}>
        <div className={styles.headingText}>
          <p className={styles.kicker}>Ride Mode</p>
          <h4>Where do you want to get off?</h4>
          <p>
            Pick where you get off and put your phone away. We will tell you
            when to get ready, when to press STOP, and when to step off.
          </p>
        </div>
        <button type="button" className={styles.close} onClick={onCancel}>
          Cancel
        </button>
      </div>

      {status === "loading" && (
        <p className={styles.status} role="status">
          Loading this trip&apos;s planned stops…
        </p>
      )}

      {status === "error" && (
        <p className={styles.status} role="alert">
          This trip&apos;s stop sequence is temporarily unavailable. Ride Mode
          cannot start safely without it.
        </p>
      )}

      {ambiguousBoarding && (
        <p className={styles.status} role="alert">
          This bus comes back to this stop later on its route, and we cannot
          tell which pass you are boarding. We will not guess about your stop.
        </p>
      )}

      {status === "ready" &&
        !ambiguousBoarding &&
        downstream.length === 0 && (
          <p className={styles.status}>
            No later drop-off stops are available for this trip.
          </p>
        )}

      {status === "ready" &&
        !ambiguousBoarding &&
        downstream.length > 0 && (
          <>
            <fieldset className={styles.stopList}>
              <legend className={styles.srOnly}>Choose your exit stop</legend>
              {downstream.map((item) => {
                const clock = plannedClock(
                  item.departureTime || item.arrivalTime
                );

                return (
                  <label
                    key={`${item.stopId}-${item.stopSequence}`}
                    className={styles.stopOption}
                    data-selected={
                      String(targetStopSequence) === String(item.stopSequence)
                        ? "true"
                        : "false"
                    }
                  >
                    <input
                      type="radio"
                      name={`ride-target-${arrival.tripref}`}
                      value={item.stopSequence}
                      checked={
                        String(targetStopSequence) === String(item.stopSequence)
                      }
                      onChange={() => {
                        setStartError("");
                        setTargetStopSequence(String(item.stopSequence));
                      }}
                    />
                    <span className={styles.stopCopy}>
                      <strong>{item.stop.name}</strong>
                      <small>
                        {stopsAwayLabel(item.stopsAway)}
                        {clock ? ` · around ${clock}` : ""}
                        {item.previousStopName
                          ? ` · after ${item.previousStopName}`
                          : ""}
                      </small>
                    </span>
                    {item.places.length > 0 && (
                      <span className={styles.placeBadge}>
                        {item.places.join(" · ")}
                      </span>
                    )}
                  </label>
                );
              })}
            </fieldset>

            <div className={styles.options}>
              <label>
                <input
                  type="checkbox"
                  checked={locationBackup}
                  onChange={(event) => setLocationBackup(event.target.checked)}
                />
                <span>
                  <strong>Follow my location (recommended)</strong>
                  <small>
                    Alerts you by where you actually are, not only by where the
                    timetable expects the bus to be. Your location stays on this
                    phone and is forgotten when the ride ends.
                  </small>
                </span>
              </label>

              <label>
                <input
                  type="checkbox"
                  checked={notifications}
                  onChange={(event) => setNotifications(event.target.checked)}
                />
                <span>
                  <strong>Alert me on the lock screen</strong>
                  <small>
                    Useful with the phone in a pocket. Keep this page open —
                    a browser can pause a tab it thinks you have left.
                  </small>
                </span>
              </label>
            </div>

            <div className={styles.safetyNote}>
              <strong>Before you rely on it</strong>
              <span>
                Starting plays a test alert, so you can check your sound and
                vibration now rather than when it matters. If live tracking
                drops out you still get the early warnings — but we will never
                say “get off now” unless we are sure.
              </span>
            </div>

            {startError && (
              <p className={styles.status} role="alert">
                {startError}
              </p>
            )}

            <div className={styles.actions}>
              <button
                type="button"
                className={styles.start}
                disabled={!targetStopSequence}
                onClick={start}
              >
                Start Ride Mode
              </button>
              <span className={styles.departureContext}>
                {arrival.lineref ? `Line ${arrival.lineref}` : "This trip"}
                {getDepartureTime(arrival)
                  ? ` · leaves ${formatClock(getDepartureTime(arrival))}`
                  : ""}
              </span>
            </div>
          </>
        )}
    </section>
  );
}
