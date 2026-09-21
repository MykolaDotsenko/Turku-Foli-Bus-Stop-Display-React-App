import { useMemo, useState } from "react";
import {
  distanceInMeters,
  findNearestStops,
  formatAccuracy,
  formatDistance,
  hasCoordinates,
  isInsideMultiPolygon,
} from "../utils/geo";
import { locationErrorMessage, requestOneTimePosition } from "../utils/location";
import { buildWalkingDirectionsUrl } from "../utils/maps";
import styles from "./NearbyStops.module.css";

const NEARBY_STOP_LIMIT = 6;
const AUTO_SELECT_MAX_DISTANCE_METERS = 2_000;
const OUTSIDE_NETWORK_WARNING_METERS = 10_000;
const AUTO_SELECT_MAX_ACCURACY_METERS = 250;
const MIN_AMBIGUITY_GAP_METERS = 25;
const MAX_AMBIGUITY_GAP_METERS = 150;
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

function NearbyStopCard({ stop, isActive, isNearest, online, onSelect }) {
  const directionsUrl = online ? buildWalkingDirectionsUrl(stop) : "";

  return (
    <article
      className={styles.stopCard}
      data-active={isActive ? "true" : "false"}
    >
      <button
        type="button"
        className={styles.stopButton}
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

      {directionsUrl && (
        <a
          className={styles.walkLink}
          href={directionsUrl}
          target="_blank"
          rel="noreferrer"
          aria-label={`Walk to ${stop.name}, stop ${stop.id}, in Google Maps`}
        >
          <span aria-hidden="true">↗</span>
          Walk there
        </a>
      )}
    </article>
  );
}

function NearbyStops({
  stops,
  coordinatesStatus,
  activeStopId,
  serviceBoundary = null,
  online = true,
  onSelect,
}) {
  const [status, setStatus] = useState("idle");
  const [position, setPosition] = useState(null);
  const [error, setError] = useState("");

  const hasStopCoordinates = stops.some(hasCoordinates);
  const geolocationSupported =
    typeof navigator !== "undefined" && "geolocation" in navigator;

  const nearbyStops = useMemo(
    () => findNearestStops(stops, position, NEARBY_STOP_LIMIT),
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
      const nextPosition = await requestOneTimePosition(
        navigator.geolocation
      );

      const nearest = findNearestStops(stops, nextPosition, NEARBY_STOP_LIMIT);
      const ambiguousChoice = nearestChoiceIsAmbiguous(
        nearest,
        nextPosition.accuracy
      );
      const insideServiceArea = isInsideMultiPolygon(
        nextPosition,
        serviceBoundary
      );

      setPosition(nextPosition);
      setStatus("success");

      const closest = nearest[0];
      const accurateEnough =
        Number.isFinite(nextPosition.accuracy) &&
        nextPosition.accuracy <= AUTO_SELECT_MAX_ACCURACY_METERS;

      if (
        closest &&
        accurateEnough &&
        insideServiceArea !== false &&
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

  const insideServiceArea = position
    ? isInsideMultiPolygon(position, serviceBoundary)
    : null;
  const nearestDistance = nearbyStops[0]?.distanceMeters;
  const isFarFromNetwork =
    nearestDistance > OUTSIDE_NETWORK_WARNING_METERS;
  const isBeyondAutoSelectRange =
    nearestDistance > AUTO_SELECT_MAX_DISTANCE_METERS &&
    !isFarFromNetwork;
  const lowAccuracy =
    Boolean(position) &&
    (!Number.isFinite(position?.accuracy) ||
      position.accuracy > AUTO_SELECT_MAX_ACCURACY_METERS);
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
  } else if (insideServiceArea === false) {
    locationNotice =
      "Your location appears outside Föli’s published service area. Nearby stops are shown for reference, but none was selected automatically.";
  } else if (isFarFromNetwork) {
    locationNotice = `The nearest Föli stop is ${formatDistance(
      nearbyStops[0].distanceMeters
    )} away. You may be outside the Föli service area.`;
  } else if (isBeyondAutoSelectRange) {
    locationNotice = `The nearest Föli stop is ${formatDistance(
      nearbyStops[0].distanceMeters
    )} away, so it was not selected automatically. Choose the stop that fits your journey.`;
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
            Find the closest stop with a one-time location check.
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
            <div
              className={styles.stopGrid}
              role="group"
              aria-label="Nearest Föli stops"
            >
              {nearbyStops.map((stop, index) => (
                <NearbyStopCard
                  key={stop.id}
                  stop={stop}
                  isNearest={index === 0}
                  isActive={stop.id === activeStopId}
                  online={online}
                  onSelect={onSelect}
                />
              ))}
            </div>
          )}

          <p className={styles.disclaimer}>
            {online
              ? "Distances are approximate straight-line distances. “Walk there” opens an external walking route in Google Maps."
              : "Distances are approximate straight-line distances. Walking route links return when you’re online."}
          </p>
        </>
      )}
    </section>
  );
}

export default NearbyStops;
