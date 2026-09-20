import { useMemo, useState } from "react";
import { findNearestStops, formatAccuracy, formatDistance, hasCoordinates } from "../utils/geo";
import { locationErrorMessage, requestOneTimePosition } from "../utils/location";
import { buildTransitDirectionsUrl } from "../utils/maps";
import { PLACE_PRESETS } from "../hooks/useSavedPlaces";
import styles from "./MyPlaces.module.css";

const MAX_SETUP_DISTANCE_METERS = 10_000;
const LOW_ACCURACY_METERS = 250;

function resolvePlaceStops(place, stops) {
  const byId = new Map(stops.map((stop) => [stop.id, stop]));

  return place.stops.map((savedStop) => ({
    ...savedStop,
    ...(byId.get(savedStop.id) || {}),
  }));
}

function SetupPlace({
  preset,
  candidates,
  accuracy,
  onCancel,
  onSave,
}) {
  const [selectedIds, setSelectedIds] = useState(
    () => new Set(candidates.map((stop) => stop.id))
  );
  const [primaryStopId, setPrimaryStopId] = useState(
    candidates[0]?.id || ""
  );

  const toggleStop = (stopId) => {
    const next = new Set(selectedIds);

    if (next.has(stopId)) {
      next.delete(stopId);
      if (primaryStopId === stopId) {
        setPrimaryStopId(
          candidates.find(
            (candidate) => candidate.id !== stopId && next.has(candidate.id)
          )?.id || ""
        );
      }
    } else {
      next.add(stopId);
      if (!primaryStopId) setPrimaryStopId(stopId);
    }

    setSelectedIds(next);
  };

  const selectedStops = candidates.filter((stop) => selectedIds.has(stop.id));

  return (
    <section
      className={styles.setup}
      aria-labelledby={`setup-${preset.id}-title`}
    >
      <div className={styles.setupHeader}>
        <div>
          <p className={styles.kicker}>Safe arrival zone</p>
          <h3 id={`setup-${preset.id}-title`}>
            Choose safe stops for {preset.label}
          </h3>
        </div>
        <button type="button" className={styles.textButton} onClick={onCancel}>
          Cancel
        </button>
      </div>

      <p className={styles.helper}>
        Only public stop IDs and names will be saved. Your exact location is
        discarded after this setup.
      </p>

      {Number.isFinite(accuracy) && (
        <p className={styles.meta}>
          Location accuracy ±{formatAccuracy(accuracy)}
          {accuracy > LOW_ACCURACY_METERS
            ? " · approximate — review the stops carefully"
            : ""}
        </p>
      )}

      <div className={styles.candidateList}>
        {candidates.map((stop) => {
          const checked = selectedIds.has(stop.id);
          return (
            <div key={stop.id} className={styles.candidate}>
              <label className={styles.safeChoice}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleStop(stop.id)}
                />
                <span>
                  <strong>{stop.name}</strong>
                  <small>
                    Stop {stop.id} · {formatDistance(stop.distanceMeters)}
                  </small>
                </span>
              </label>

              <label className={styles.primaryChoice}>
                <input
                  type="radio"
                  name={`primary-${preset.id}`}
                  checked={primaryStopId === stop.id}
                  disabled={!checked}
                  onChange={() => setPrimaryStopId(stop.id)}
                />
                Primary
              </label>
            </div>
          );
        })}
      </div>

      <div className={styles.setupActions}>
        <button
          type="button"
          className={styles.primaryButton}
          disabled={selectedStops.length === 0 || !primaryStopId}
          onClick={() =>
            onSave({
              id: preset.id,
              stops: selectedStops,
              primaryStopId,
            })
          }
        >
          Save {preset.label}
        </button>
      </div>
    </section>
  );
}

function DriverCard({ place, primaryStop, onClose }) {
  return (
    <section
      className={styles.driverCard}
      role="dialog"
      aria-modal="false"
      aria-labelledby={`driver-${place.id}-title`}
    >
      <p className={styles.kicker}>Show this screen to the driver</p>
      <h3 id={`driver-${place.id}-title`}>I need to get to {place.label}</h3>
      <p className={styles.driverStop}>
        {primaryStop.name}
        <span>Stop {primaryStop.id}</span>
      </p>
      <p className={styles.finnish}>
        Voitteko auttaa minua jäämään pois oikealla pysäkillä?
      </p>
      <button type="button" className={styles.textButton} onClick={onClose}>
        Close
      </button>
    </section>
  );
}

function PlaceCard({
  place,
  stops,
  onOpenStop,
  onSetPrimaryStop,
  onReplace,
  onRemove,
}) {
  const [showDriver, setShowDriver] = useState(false);
  const resolvedStops = resolvePlaceStops(place, stops);
  const primaryStop =
    resolvedStops.find((stop) => stop.id === place.primaryStopId) ||
    resolvedStops[0];
  const transitUrl = hasCoordinates(primaryStop)
    ? buildTransitDirectionsUrl(primaryStop)
    : "";

  return (
    <article className={styles.placeCard}>
      <div className={styles.placeHeading}>
        <span className={styles.placeIcon} aria-hidden="true">
          {place.icon}
        </span>
        <div>
          <h3>{place.label}</h3>
          <p>
            Primary: {primaryStop.name} · stop {primaryStop.id}
          </p>
        </div>
      </div>

      <div className={styles.placeActions}>
        {transitUrl ? (
          <a
            className={styles.goButton}
            href={transitUrl}
            target="_blank"
            rel="noreferrer"
            aria-label={`Go to ${place.label} by public transit`}
          >
            Go {place.label}
          </a>
        ) : (
          <button type="button" className={styles.goButton} disabled>
            Go {place.label}
          </button>
        )}

        <button
          type="button"
          className={styles.secondaryButton}
          onClick={() => onOpenStop(primaryStop.id)}
        >
          Live departures
        </button>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={() => setShowDriver(true)}
        >
          Show driver
        </button>
      </div>

      {resolvedStops.length > 1 && (
        <details className={styles.backups}>
          <summary>
            {resolvedStops.length - 1} backup safe stop
            {resolvedStops.length > 2 ? "s" : ""}
          </summary>
          <div className={styles.backupList}>
            {resolvedStops.map((stop) => (
              <div key={stop.id} className={styles.backupRow}>
                <span>
                  <strong>{stop.name}</strong>
                  <small>Stop {stop.id}</small>
                </span>
                {stop.id === primaryStop.id ? (
                  <span className={styles.primaryBadge}>Primary</span>
                ) : (
                  <button
                    type="button"
                    className={styles.textButton}
                    onClick={() => onSetPrimaryStop(place.id, stop.id)}
                  >
                    Make primary
                  </button>
                )}
              </div>
            ))}
          </div>
        </details>
      )}

      <details className={styles.manage}>
        <summary>Manage {place.label}</summary>
        <div className={styles.manageActions}>
          <button
            type="button"
            className={styles.textButton}
            onClick={() => onReplace(place.id)}
          >
            Replace using where I am now
          </button>
          <button
            type="button"
            className={styles.dangerButton}
            onClick={() => {
              if (window.confirm(`Remove ${place.label} from My Places?`)) {
                onRemove(place.id);
              }
            }}
          >
            Remove {place.label}
          </button>
        </div>
      </details>

      {showDriver && (
        <DriverCard
          place={place}
          primaryStop={primaryStop}
          onClose={() => setShowDriver(false)}
        />
      )}
    </article>
  );
}

function MyPlaces({
  stops,
  coordinatesStatus,
  activeStopId,
  placesById,
  onSavePlace,
  onRemovePlace,
  onSetPrimaryStop,
  onOpenStop,
}) {
  const [setupId, setSetupId] = useState("");
  const [setupCandidates, setSetupCandidates] = useState([]);
  const [setupAccuracy, setSetupAccuracy] = useState(null);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  const hasStopCoordinates = useMemo(
    () => stops.some(hasCoordinates),
    [stops]
  );
  const activeStop = useMemo(
    () => stops.find((stop) => stop.id === activeStopId) || null,
    [activeStopId, stops]
  );

  const startSetup = async (placeId) => {
    const preset = PLACE_PRESETS.find((candidate) => candidate.id === placeId);
    if (!preset) return;

    if (!hasStopCoordinates) {
      setError(
        coordinatesStatus === "loading"
          ? "Stop locations are still loading. Try again in a moment."
          : "Stop locations are temporarily unavailable."
      );
      return;
    }

    if (!navigator.geolocation) {
      setError("This browser does not support location access.");
      return;
    }

    setStatus("locating");
    setError("");

    try {
      const position = await requestOneTimePosition(navigator.geolocation);
      const nearest = findNearestStops(stops, position, 3);

      if (nearest.length === 0) {
        throw new Error("No nearby stops found.");
      }

      if (nearest[0].distanceMeters > MAX_SETUP_DISTANCE_METERS) {
        setStatus("idle");
        setError(
          `The nearest Föli stop is ${formatDistance(
            nearest[0].distanceMeters
          )} away. Move closer to the place before saving it.`
        );
        return;
      }

      setSetupId(preset.id);
      setSetupCandidates(nearest);
      setSetupAccuracy(position.accuracy);
      setStatus("ready");
    } catch (locationError) {
      setStatus("idle");
      setError(locationErrorMessage(locationError));
    }
  };

  return (
    <section className={styles.wrapper} aria-labelledby="my-places-title">
      <div className={styles.header}>
        <div>
          <p className={styles.kicker}>No address to remember</p>
          <h2 id="my-places-title">My Places</h2>
          <p className={styles.description}>
            Save Home, School or Work as a small set of safe public stops.
            Exact private addresses are not stored.
          </p>
        </div>
      </div>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <div className={styles.grid}>
        {PLACE_PRESETS.map((preset) => {
          const place = placesById.get(preset.id);

          if (place) {
            return (
              <PlaceCard
                key={preset.id}
                place={place}
                stops={stops}
                onOpenStop={onOpenStop}
                onSetPrimaryStop={onSetPrimaryStop}
                onReplace={startSetup}
                onRemove={onRemovePlace}
              />
            );
          }

          return (
            <article key={preset.id} className={styles.emptyCard}>
              <span className={styles.placeIcon} aria-hidden="true">
                {preset.icon}
              </span>
              <div>
                <h3>{preset.label}</h3>
                <p>Save nearby safe stops without typing an address.</p>
              </div>
              <div className={styles.emptyActions}>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={() => startSetup(preset.id)}
                  disabled={status === "locating"}
                  aria-busy={status === "locating" && setupId === preset.id}
                >
                  Set up here
                </button>
                {activeStop && (
                  <button
                    type="button"
                    className={styles.textButton}
                    onClick={() =>
                      onSavePlace({
                        id: preset.id,
                        stops: [{ id: activeStop.id, name: activeStop.name }],
                        primaryStopId: activeStop.id,
                      })
                    }
                  >
                    Save selected stop
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {status === "locating" && (
        <p className={styles.meta} role="status">
          Finding the closest Föli stops…
        </p>
      )}

      {setupId && setupCandidates.length > 0 && (
        <SetupPlace
          preset={PLACE_PRESETS.find((preset) => preset.id === setupId)}
          candidates={setupCandidates}
          accuracy={setupAccuracy}
          onCancel={() => {
            setSetupId("");
            setSetupCandidates([]);
            setSetupAccuracy(null);
            setStatus("idle");
          }}
          onSave={(place) => {
            onSavePlace(place);
            setSetupId("");
            setSetupCandidates([]);
            setSetupAccuracy(null);
            setStatus("idle");
          }}
        />
      )}

      <p className={styles.privacy}>
        Transit links open externally with only the public destination stop.
        Your starting location is not embedded in the link.
      </p>
    </section>
  );
}

export default MyPlaces;
