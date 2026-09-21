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

    return stopTimes
      .slice(boardingIndex + 1)
      .filter((item) => Number(item.dropOffType) !== 1)
      .map((item) => ({
        ...item,
        stop: stopsById.get(String(item.stopId)) || {
          id: String(item.stopId),
          name: `Stop ${item.stopId}`,
        },
        places: savedPlaceLabels(placesById, item.stopId),
      }));
  }, [boardingIndex, placesById, stopTimes, stopsById]);

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

    if (!selectedTarget || !departureEpochSec) return;

    const plan = buildRidePlan({
      stopTimes,
      currentStopId,
      currentStopAimedEpochSec: arrival.aimeddeparturetime,
      targetStopId: selectedTarget.stopId,
      targetStopSequence: selectedTarget.stopSequence,
      stopsById,
      departureEpochSec,
    });
    if (!plan) return;

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
        <div>
          <p className={styles.kicker}>Ride Mode</p>
          <h4>Where do you want to get off?</h4>
          <p>
            Choose the exact stop on this trip. GPS follows your movement along
            this trip&apos;s planned path while Föli realtime independently
            confirms progress.
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
          This trip passes the current stop more than once and its planned time
          does not identify the boarding pass safely. Ride Mode will not guess.
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
              {downstream.map((item, index) => {
                const clock = plannedClock(
                  item.departureTime || item.arrivalTime
                );
                const previous =
                  index === 0
                    ? currentStopName
                    : downstream[index - 1]?.stop?.name;

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
                      onChange={() =>
                        setTargetStopSequence(String(item.stopSequence))
                      }
                    />
                    <span className={styles.stopCopy}>
                      <strong>{item.stop.name}</strong>
                      <small>
                        {clock ? `planned ${clock}` : "planned stop"}
                        {previous ? ` · after ${previous}` : ""}
                        {Number.isFinite(Number(item.shapeDistTraveled))
                          ? ` · route point ${Math.round(
                              Number(item.shapeDistTraveled)
                            )} m`
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
                  <strong>Use GPS ride tracking (recommended)</strong>
                  <small>
                    GPS is map-matched to this trip&apos;s GTFS path on this
                    device. Coordinates stay in memory only and are discarded
                    when the ride ends.
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
                  <strong>Use system notifications when available</strong>
                  <small>
                    Helpful on the lock screen, but browsers may still suspend a
                    web app in the background.
                  </small>
                </span>
              </label>
            </div>

            <div className={styles.safetyNote}>
              <strong>Before you rely on it</strong>
              <span>
                Starting Ride Mode plays a test alert. GPS and Föli realtime
                reinforce each other; schedule-only data never triggers a
                definitive “get off now”.
              </span>
            </div>

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
