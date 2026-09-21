import { useEffect, useMemo, useState } from "react";
import { fetchTripStopTimes } from "../api/foliApi";
import { buildRidePlan } from "../utils/rideProgress";
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
  onStart,
  onCancel,
}) {
  const [status, setStatus] = useState("loading");
  const [stopTimes, setStopTimes] = useState([]);
  const [targetStopId, setTargetStopId] = useState("");
  const [locationBackup, setLocationBackup] = useState(true);
  const [notifications, setNotifications] = useState(true);

  useEffect(() => {
    if (!arrival?.tripref) {
      setStatus("error");
      return undefined;
    }

    const controller = new AbortController();
    setStatus("loading");

    fetchTripStopTimes(arrival.tripref, controller.signal)
      .then((items) => {
        if (controller.signal.aborted) return;
        setStopTimes(items);
        setStatus("ready");
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatus("error");
      });

    return () => controller.abort();
  }, [arrival?.tripref]);

  const downstream = useMemo(() => {
    const currentIndex = stopTimes.findIndex(
      (item) => String(item.stopId) === String(currentStopId)
    );
    if (currentIndex < 0) return [];

    return stopTimes
      .slice(currentIndex + 1)
      .filter((item) => Number(item.dropOffType) !== 1)
      .map((item) => ({
        ...item,
        stop: stopsById.get(String(item.stopId)) || {
          id: String(item.stopId),
          name: `Stop ${item.stopId}`,
        },
        places: savedPlaceLabels(placesById, item.stopId),
      }));
  }, [currentStopId, placesById, stopTimes, stopsById]);

  useEffect(() => {
    if (targetStopId || downstream.length === 0) return;

    const home = downstream.find((item) => item.places.includes("Home"));
    if (home) setTargetStopId(String(home.stopId));
  }, [downstream, targetStopId]);

  const start = () => {
    const departureEpochSec = getDepartureTime(arrival);
    if (!targetStopId || !departureEpochSec) return;

    const plan = buildRidePlan({
      stopTimes,
      currentStopId,
      targetStopId,
      stopsById,
      departureEpochSec,
    });
    if (!plan) return;

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
      boardingStop: {
        id: String(currentStopId),
        name: currentStopName || `Stop ${currentStopId}`,
      },
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

  return (
    <section className={styles.panel} aria-label="Set up get-off alerts">
      <div className={styles.heading}>
        <div>
          <p className={styles.kicker}>Ride Mode</p>
          <h4>Where do you want to get off?</h4>
          <p>
            Choose a stop on this trip. The app will warn you before it is time
            to press STOP.
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

      {status === "ready" && downstream.length === 0 && (
        <p className={styles.status}>
          No later drop-off stops are available for this trip.
        </p>
      )}

      {status === "ready" && downstream.length > 0 && (
        <>
          <fieldset className={styles.stopList}>
            <legend className="sr-only">Choose your exit stop</legend>
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
                    String(targetStopId) === String(item.stopId)
                      ? "true"
                      : "false"
                  }
                >
                  <input
                    type="radio"
                    name={`ride-target-${arrival.tripref}`}
                    value={item.stopId}
                    checked={String(targetStopId) === String(item.stopId)}
                    onChange={() => setTargetStopId(String(item.stopId))}
                  />
                  <span className={styles.stopCopy}>
                    <strong>{item.stop.name}</strong>
                    <small>
                      {clock ? `planned ${clock}` : "planned stop"}
                      {previous ? ` · after ${previous}` : ""}
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
                <strong>Use location as a backup</strong>
                <small>
                  Recommended. Used only during this active ride, only on this
                  device, and never stored.
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
              Starting Ride Mode plays a test sound and vibration where
              supported. Keep this page open for the most reliable client-only
              tracking.
            </span>
          </div>

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.start}
              disabled={!targetStopId}
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
