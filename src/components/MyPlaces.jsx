import { useMemo, useState } from "react";
import {
  findNearestStops,
  formatAccuracy,
  formatDistance,
  hasCoordinates,
  isInsideMultiPolygon,
} from "../utils/geo";
import { locationErrorMessage, requestOneTimePosition } from "../utils/location";
import { buildTransitDirectionsUrl } from "../utils/maps";
import { buildSharedPlaceUrl } from "../utils/sharedPlaces";
import { PLACE_PRESETS } from "../hooks/useSavedPlaces";
import SafePlaceDriverCard from "./SafePlaceDriverCard";
import styles from "./MyPlaces.module.css";

const MAX_SETUP_DISTANCE_METERS = 10_000;
const AUTO_PRESELECT_MAX_DISTANCE_METERS = 2_000;
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
  preselectFirst = false,
  onCancel,
  onSave,
}) {
  const reliableLocation =
    Number.isFinite(accuracy) &&
    accuracy <= LOW_ACCURACY_METERS &&
    Number.isFinite(candidates[0]?.distanceMeters) &&
    candidates[0].distanceMeters <= AUTO_PRESELECT_MAX_DISTANCE_METERS;
  const shouldPreselectFirst = preselectFirst || reliableLocation;
  const [selectedIds, setSelectedIds] = useState(
    () =>
      new Set(shouldPreselectFirst && candidates[0] ? [candidates[0].id] : [])
  );
  const [primaryStopId, setPrimaryStopId] = useState(
    shouldPreselectFirst ? candidates[0]?.id || "" : ""
  );
  const [confirmedSafe, setConfirmedSafe] = useState(false);

  const toggleStop = (stopId) => {
    const next = new Set(selectedIds);
    setConfirmedSafe(false);

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
  const confirmationLabel = `I confirm the selected ${
    selectedStops.length === 1 ? "stop is" : "stops are"
  } suitable and intended for arriving at ${preset.label}.`;

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
        {preselectFirst
          ? "Review the public stop you selected and confirm that it is suitable for this destination."
          : "When location quality is good and a stop is reasonably close, the nearest stop is selected first. Otherwise you must choose manually."}
        {" "}Add backup stops only if you know they are suitable and familiar for
        arriving at {preset.label}. Only public stop IDs and names are saved;
        your exact location is discarded.
      </p>

      <p className={styles.meta}>
        {preselectFirst
          ? "Using the stop you selected manually"
          : Number.isFinite(accuracy)
            ? `Location accuracy ±${formatAccuracy(accuracy)}`
            : "Location accuracy unavailable"}
        {!preselectFirst && !reliableLocation
          ? " · no stop was preselected — choose and confirm an arrival stop yourself"
          : ""}
      </p>

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

      <label className={styles.confirmSafe}>
        <input
          type="checkbox"
          checked={confirmedSafe}
          onChange={(event) => setConfirmedSafe(event.target.checked)}
        />
        <span>{confirmationLabel}</span>
      </label>

      <div className={styles.setupActions}>
        <button
          type="button"
          className={styles.primaryButton}
          disabled={
            selectedStops.length === 0 || !primaryStopId || !confirmedSafe
          }
          onClick={() =>
            onSave({
              id: preset.id,
              stops: selectedStops.map((stop) => ({
                id: stop.id,
                name: stop.name,
              })),
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

function journeyAction(place) {
  return place.id === "home" ? "Go Home" : `Go to ${place.label}`;
}

function SharedPlaceImport({ place, replacing, onImport, onDismiss }) {
  const preset = PLACE_PRESETS.find((candidate) => candidate.id === place.id);
  if (!preset) return null;

  return (
    <section
      className={styles.importCard}
      aria-labelledby="shared-place-title"
    >
      <p className={styles.kicker}>Shared Safe Place</p>
      <h3 id="shared-place-title">
        {replacing ? `Replace ${preset.label}?` : `Add ${preset.label}?`}
      </h3>
      <p className={styles.helper}>
        This link contains public Föli stop IDs and names, not an exact private
        address. Those stops can still reveal the general area of this place.
        The app cannot verify who created the link, so accept shared places only
        from someone you trust.
      </p>
      <div className={styles.importStops}>
        {place.stops.map((stop) => (
          <span key={stop.id}>
            <strong>{stop.name}</strong>
            <small>
              Stop {stop.id}
              {stop.id === place.primaryStopId ? " · primary" : ""}
            </small>
          </span>
        ))}
      </div>
      <div className={styles.setupActions}>
        <button type="button" className={styles.primaryButton} onClick={onImport}>
          {replacing ? `Replace ${preset.label}` : `Add ${preset.label}`}
        </button>
        <button type="button" className={styles.textButton} onClick={onDismiss}>
          Not now
        </button>
      </div>
    </section>
  );
}

function PlaceCard({
  place,
  stops,
  online,
  onOpenStop,
  onSetPrimaryStop,
  onReplace,
  onRemove,
}) {
  const [showDriver, setShowDriver] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const [shareFeedback, setShareFeedback] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const resolvedStops = resolvePlaceStops(place, stops);
  const primaryStop =
    resolvedStops.find((stop) => stop.id === place.primaryStopId) ||
    resolvedStops[0];
  const transitUrl =
    online && hasCoordinates(primaryStop)
      ? buildTransitDirectionsUrl(primaryStop)
      : "";

  const sharePlace = async () => {
    const url = buildSharedPlaceUrl(place);
    if (!url) return;

    setShareFeedback("");
    setShareUrl("");

    try {
      if (typeof navigator?.share === "function") {
        await navigator.share({
          title: `${place.label} · Föli Safe Place`,
          text: `Add ${place.label} to My Places`,
          url,
        });
        setShareFeedback("Safe Place shared.");
        return;
      }

      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setShareFeedback("Share link copied.");
        return;
      }
    } catch (error) {
      if (error?.name === "AbortError") return;
    }

    setShareUrl(url);
    setShareFeedback("Copy the share link below.");
  };

  return (
    <article
      className={styles.placeCard}
      data-mobile-expanded={mobileExpanded ? "true" : "false"}
    >
      <button
        type="button"
        className={styles.mobileSummary}
        onClick={() => setMobileExpanded((current) => !current)}
        aria-expanded={mobileExpanded}
      >
        <span className={styles.placeIcon} aria-hidden="true">
          {place.icon}
        </span>
        <span className={styles.mobileSummaryText}>
          <strong>{place.label}</strong>
          <small>{primaryStop.name} · stop {primaryStop.id}</small>
        </span>
        <span className={styles.mobileSummaryAction} aria-hidden="true">
          {mobileExpanded ? "−" : "›"}
        </span>
      </button>

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
            aria-label={`${journeyAction(place)} by public transit`}
          >
            {journeyAction(place)}
          </a>
        ) : (
          <button type="button" className={styles.goButton} disabled>
            {journeyAction(place)}
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
        <p className={styles.sharePrivacyHint}>
          Sharing {place.label} reveals its saved public stop names and IDs,
          which can indicate the general area.
        </p>
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
            className={styles.textButton}
            onClick={sharePlace}
          >
            Share {place.label}
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
        {shareFeedback && (
          <p className={styles.shareFeedback} role="status">
            {shareFeedback}
          </p>
        )}
        {shareUrl && (
          <input
            className={styles.shareInput}
            aria-label={`Share link for ${place.label}`}
            readOnly
            value={shareUrl}
            onFocus={(event) => event.currentTarget.select()}
          />
        )}
      </details>

      {showDriver && (
        <SafePlaceDriverCard
          place={place}
          primaryStop={primaryStop}
          idPrefix="place"
          onClose={() => setShowDriver(false)}
        />
      )}
    </article>
  );
}

function EmptyPlaceCard({
  preset,
  activeStop,
  status,
  onStartSetup,
  onStartFromSelectedStop,
}) {
  const [mobileExpanded, setMobileExpanded] = useState(false);

  return (
    <article
      className={styles.emptyCard}
      data-mobile-expanded={mobileExpanded ? "true" : "false"}
    >
      <button
        type="button"
        className={styles.mobileSummary}
        onClick={() => setMobileExpanded((current) => !current)}
        aria-expanded={mobileExpanded}
      >
        <span className={styles.placeIcon} aria-hidden="true">
          {preset.icon}
        </span>
        <span className={styles.mobileSummaryText}>
          <strong>{preset.label}</strong>
          <small>Not set</small>
        </span>
        <span className={styles.mobileSummaryAction} aria-hidden="true">
          {mobileExpanded ? "−" : "+"}
        </span>
      </button>

      <div className={styles.emptyBody}>
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
            onClick={() => onStartSetup(preset.id)}
            disabled={status === "locating"}
            aria-busy={status === "locating"}
            aria-label={`Set up ${preset.label} where I am now`}
          >
            Set up here
          </button>
          {activeStop && (
            <button
              type="button"
              className={styles.textButton}
              onClick={() => onStartFromSelectedStop(preset.id)}
              aria-label={`Review selected stop for ${preset.label}`}
            >
              Review selected stop
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function MyPlaces({
  stops,
  coordinatesStatus,
  activeStopId,
  placesById,
  sharedPlace,
  serviceBoundary = null,
  online = true,
  onSavePlace,
  onImportSharedPlace,
  onDismissSharedPlace,
  onRemovePlace,
  onSetPrimaryStop,
  onOpenStop,
}) {
  const [setupId, setSetupId] = useState("");
  const [setupCandidates, setSetupCandidates] = useState([]);
  const [setupAccuracy, setSetupAccuracy] = useState(null);
  const [setupPreselectFirst, setSetupPreselectFirst] = useState(false);
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
      const insideServiceArea = isInsideMultiPolygon(
        position,
        serviceBoundary
      );

      const boundaryDecisionReliable =
        Number.isFinite(position.accuracy) &&
        position.accuracy <= LOW_ACCURACY_METERS;

      if (insideServiceArea === false && boundaryDecisionReliable) {
        setStatus("idle");
        setError(
          "This location appears outside Föli’s published service area. Choose a public stop manually instead."
        );
        return;
      }

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
      setSetupPreselectFirst(false);
      setStatus("ready");
    } catch (locationError) {
      setStatus("idle");
      setError(locationErrorMessage(locationError));
    }
  };

  const startFromSelectedStop = (placeId) => {
    const preset = PLACE_PRESETS.find((candidate) => candidate.id === placeId);
    if (!preset || !activeStop) return;

    setError("");
    setSetupId(preset.id);
    setSetupCandidates([{ id: activeStop.id, name: activeStop.name }]);
    setSetupAccuracy(null);
    setSetupPreselectFirst(true);
    setStatus("ready");
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

      {sharedPlace && (
        <SharedPlaceImport
          place={sharedPlace}
          replacing={placesById.has(sharedPlace.id)}
          onImport={onImportSharedPlace}
          onDismiss={onDismissSharedPlace}
        />
      )}

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
                online={online}
                onOpenStop={onOpenStop}
                onSetPrimaryStop={onSetPrimaryStop}
                onReplace={startSetup}
                onRemove={onRemovePlace}
              />
            );
          }

          return (
            <EmptyPlaceCard
              key={preset.id}
              preset={preset}
              activeStop={activeStop}
              status={status}
              onStartSetup={startSetup}
              onStartFromSelectedStop={startFromSelectedStop}
            />
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
          preselectFirst={setupPreselectFirst}
          onCancel={() => {
            setSetupId("");
            setSetupCandidates([]);
            setSetupAccuracy(null);
            setSetupPreselectFirst(false);
            setStatus("idle");
          }}
          onSave={(place) => {
            onSavePlace(place);
            setSetupId("");
            setSetupCandidates([]);
            setSetupAccuracy(null);
            setSetupPreselectFirst(false);
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
