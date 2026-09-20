import { useMemo, useState } from "react";
import {
  distanceInMeters,
  findNearestStops,
  formatAccuracy,
  formatDistance,
  hasCoordinates,
} from "../utils/geo";
import styles from "./NearbyStops.module.css";

const AUTO_SELECT_MAX_DISTANCE_METERS = 10_000;
const AUTO_SELECT_MAX_ACCURACY_METERS = 250;
const MIN_AMBIGUITY_GAP_METERS = 25;
const MAX_AMBIGUITY_GAP_METERS = 150;
const LOCATION_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 8_000,
  maximumAge: 30_000,
};
const FALLBACK_LOCATION_OPTIONS = {
  enableHighAccuracy: false,
  timeout: 5_000,
  maximumAge: 120_000,
};

function locationErrorMessage(error) {
  if (error?.code === 1) {
    return "Location access is blocked. Allow location for this site in your browser settings and try again.";
  }

  if (error?.code === 2) {
    return "Your device could not determine its location. Check location services and try again.";
  }

  if (error?.code === 3) {
    return "Location took too long to respond. Move near a window or try again.";
  }

  return "Your location could not be read. Try again or search for a stop manually.";
}

function readPosition(geolocation, options) {
  return new Promise((resolve, reject) => {
    geolocation.getCurrentPosition(resolve, reject, options);
  });
}

async function getBestAvailablePosition(geolocation) {
  try {
    return await readPosition(geolocation, LOCATION_OPTIONS);
  } catch (error) {
    if (error?.code !== 3) throw error;
    return readPosition(geolocation, FALLBACK_LOCATION_OPTIONS);
  }
}

function nearestChoiceIsAmbiguous(nearbyStops, accuracy) {
  if (nearbyStops.length < 2) return false;

  const uncertainty = Number.isFinite(accuracy)
    ? Math.min(
        MAX_AMBIGUITY_GAP_METERS,
        Math.max(MIN_AMBIGUITY_GAP_METERS, accuracy)
      )
    : MIN_AMBIGUITY_GAP_METERS;

  return (
    nearbyStops[1].distanceMeters - nearbyStops[0].distanceMeters <
    uncertainty
  );
}

function NearbyStopButton({ stop, isActive, isNearest, onSelect }) {
  return (
    <button
      type="button"
      className={styles.stopButton}
      data-active={isActive ? "true" : "false"}
      onClick={() => onSelect(stop.id)}
      aria-label={`${stop.name}, stop ${stop.id}, ${formatDistance(
        stop.distanceMeters
      )} away`}
    >
      <span className={styles.stopText}>
        <strong>{stop.name}</strong>
        <span>
          Stop {stop.id} · {formatDistance(stop.distanceMeters)}
        </span>
      </span>
      {isNearest && <span className={styles.nearestBadge}>Nearest</span>}
    </button>
  );
}

function NearbyStops({
  stops,
  coordinatesStatus,
  activeStopId,
  onSelect,
}) {
  const [status, setStatus] = useState("idle");
  const [position, setPosition] = useState(null);
  const [error, setError] = useState("");

  const hasStopCoordinates = stops.some(hasCoordinates);
  const geolocationSupported =
    typeof navigator !== "undefined" && "geolocation" in navigator;

  const nearbyStops = useMemo(
    () => findNearestStops(stops, position, 3),
    [position, stops]
  );

  const selectedStopDistance = useMemo(() => {
    if (!position) return null;

    const activeStop = stops.find(
      (stop) => stop.id === activeStopId && hasCoordinates(stop)
    );
    if (!activeStop) return null;

    return distanceInMeters(position, {
      lat: activeStop.lat,
      lon: activeStop.lon,
    });
  }, [activeStopId, position, stops]);

  const locate = async () => {
    if (!geolocationSupported) {
      setStatus("error");
      setError("This browser does not support location access.");
      return;
    }

    if (!hasStopCoordinates) {
      setStatus("error");
      setError(
        coordinatesStatus === "loading"
          ? "Nearby-stop data is still loading. Try again in a moment."
          : "Stop coordinates are temporarily unavailable. Search for a stop manually and try again later."
      );
      return;
    }

    setStatus("locating");
    setError("");

    try {
      const result = await getBestAvailablePosition(navigator.geolocation);
      const nextPosition = {
        lat: Number(result.coords.latitude),
        lon: Number(result.coords.longitude),
        accuracy: Number.isFinite(Number(result.coords.accuracy))
          ? Number(result.coords.accuracy)
          : null,
      };

      if (!hasCoordinates(nextPosition)) {
        throw new Error("Invalid browser location.");
      }

      const nearest = findNearestStops(stops, nextPosition, 3);
      const ambiguousChoice = nearestChoiceIsAmbiguous(
        nearest,
        nextPosition.accuracy
      );

      setPosition(nextPosition);
      setStatus("success");

      const closest = nearest[0];
      const accurateEnough =
        nextPosition.accuracy === null ||
        nextPosition.accuracy <= AUTO_SELECT_MAX_ACCURACY_METERS;

      if (
        closest &&
        accurateEnough &&
        !ambiguousChoice &&
        closest.distanceMeters <= AUTO_SELECT_MAX_DISTANCE_METERS &&
        closest.id !== activeStopId
      ) {
        onSelect(closest.id);
      }
    } catch (locationError) {
      setStatus("error");
      setError(locationErrorMessage(locationError));
    }
  };

  const isFarFromNetwork =
    nearbyStops[0]?.distanceMeters > AUTO_SELECT_MAX_DISTANCE_METERS;
  const lowAccuracy =
    position?.accuracy > AUTO_SELECT_MAX_ACCURACY_METERS;
  const ambiguousChoice =
    position &&
    !lowAccuracy &&
    !isFarFromNetwork &&
    nearestChoiceIsAmbiguous(nearbyStops, position.accuracy);
  const locationDataLoading =
    coordinatesStatus === "loading" && !hasStopCoordinates;

  let locationNotice = "";
  if (lowAccuracy) {
    locationNotice =
      "Your location is approximate, so compare the nearby options before choosing.";
  } else if (isFarFromNetwork) {
    locationNotice = `The nearest Föli stop is ${formatDistance(
      nearbyStops[0].distanceMeters
    )} away. You may be outside the Föli service area.`;
  } else if (ambiguousChoice) {
    locationNotice =
      "Two stops are almost equally close. Choose the stop that serves your travel direction.";
  }

  return (
    <section className={styles.wrapper} aria-labelledby="nearby-stops-title">
      <div className={styles.header}>
        <div>
          <h2 id="nearby-stops-title" className={styles.heading}>
            Near you
          </h2>
          <p className={styles.description}>
            Find the closest Föli stop with a one-time location check. Your coordinates are not stored.
          </p>
        </div>

        <button
          type="button"
          className={styles.locateButton}
          onClick={locate}
          disabled={status === "locating" || !hasStopCoordinates}
          aria-busy={status === "locating"}
        >
          <span aria-hidden="true">{status === "locating" ? "…" : "⌖"}</span>
          {status === "locating"
            ? "Locating…"
            : position
              ? "Update location"
              : "Find nearest stop"}
        </button>
      </div>

      {!hasStopCoordinates && (
        <p className={styles.meta} role="status">
          {locationDataLoading
            ? "Preparing stop coordinates…"
            : "Location search is temporarily unavailable; stop search still works normally."}
        </p>
      )}

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {position && (
        <>
          <div className={styles.meta} role="status" aria-live="polite">
            <span>One-time location only</span>
            {position.accuracy !== null && (
              <span>Accuracy ±{formatAccuracy(position.accuracy)}</span>
            )}
            {Number.isFinite(selectedStopDistance) && (
              <span>
                Selected stop ≈ {formatDistance(selectedStopDistance)} away
              </span>
            )}
          </div>

          {locationNotice && (
            <p className={styles.notice}>{locationNotice}</p>
          )}

          {nearbyStops.length > 0 && (
            <div\n              className={styles.stopGrid}\n              role="group"\n              aria-label="Nearest Föli stops"\n            >
              {nearbyStops.map((stop, index) => (
                <NearbyStopButton
                  key={stop.id}
                  stop={stop}
                  isNearest={index === 0}
                  isActive={stop.id === activeStopId}
                  onSelect={onSelect}
                />
              ))}
            </div>
          )}

          <p className={styles.disclaimer}>
            Distances are approximate straight-line distances, not walking-route
            distances.
          </p>
        </>
      )}
    </section>
  );
}

export default NearbyStops;
