import { useMemo, useState } from "react";
import { msg, t, useLanguage } from "../i18n";
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
import { PLACE_PRESETS, placeLabel } from "../hooks/useSavedPlaces";
import SafePlaceDriverCard from "./SafePlaceDriverCard";
import styles from "./MyPlaces.module.css";
import { stopLabel } from "../utils/stopNames";
import StopName from "./StopName";

const MAX_SETUP_DISTANCE_METERS = 10_000;
const AUTO_PRESELECT_MAX_DISTANCE_METERS = 2_000;
const LOW_ACCURACY_METERS = 250;

// Phrases that name a place are the place's own: Finnish puts the place in
// the case the sentence needs ("kotiin", "kodin", "koulun", "työpaikan"),
// which a label set into a shared phrase cannot take. Stop names are the
// ones never inflected (docs/LOCALIZATION.md).
const PLACE_PHRASES = {
  home: {
    go: msg("Get me Home"),
    choose: msg("Tick the stops you use to get Home, and mark one as Primary."),
    rightStop: msg("Yes, this is the right stop for Home."),
    rightStops: msg("Yes, these are the right stops for Home."),
    backupAdvice: msg(
      "Add backup stops only if you know they are suitable and familiar for arriving at Home."
    ),
    open: msg("Open Home stop"),
    setupTitle: msg("Choose stops for Home"),
    locate: msg("Use my location to set up Home"),
    useStop: msg("Use {name} for Home"),
    manage: msg("Manage Home"),
    sharing: msg(
      "Sharing Home reveals its saved public stop names and IDs, which can indicate the general area."
    ),
  },
  school: {
    go: msg("Go to School"),
    choose: msg("Tick the stops you use to get to School, and mark one as Primary."),
    rightStop: msg("Yes, this is the right stop for School."),
    rightStops: msg("Yes, these are the right stops for School."),
    backupAdvice: msg(
      "Add backup stops only if you know they are suitable and familiar for arriving at School."
    ),
    open: msg("Open School stop"),
    setupTitle: msg("Choose stops for School"),
    locate: msg("Use my location to set up School"),
    useStop: msg("Use {name} for School"),
    manage: msg("Manage School"),
    sharing: msg(
      "Sharing School reveals its saved public stop names and IDs, which can indicate the general area."
    ),
  },
  work: {
    go: msg("Go to Work"),
    choose: msg("Tick the stops you use to get to Work, and mark one as Primary."),
    rightStop: msg("Yes, this is the right stop for Work."),
    rightStops: msg("Yes, these are the right stops for Work."),
    backupAdvice: msg(
      "Add backup stops only if you know they are suitable and familiar for arriving at Work."
    ),
    open: msg("Open Work stop"),
    setupTitle: msg("Choose stops for Work"),
    locate: msg("Use my location to set up Work"),
    useStop: msg("Use {name} for Work"),
    manage: msg("Manage Work"),
    sharing: msg(
      "Sharing Work reveals its saved public stop names and IDs, which can indicate the general area."
    ),
  },
};

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
  const phrases = PLACE_PHRASES[preset.id];
  const label = placeLabel(preset);
  // Plain words, and no "safe": a parent reads that as a promise about the
  // stop itself, which no app can make.
  const confirmationLabel = t(
    selectedStops.length === 1 ? phrases.rightStop : phrases.rightStops
  );

  return (
    <section
      className={styles.setup}
      aria-labelledby={`setup-${preset.id}-title`}
    >
      <div className={styles.setupHeader}>
        <div>
          <p className={styles.kicker}>{t("My Places")}</p>
          <h3 id={`setup-${preset.id}-title`}>
            {t(phrases.setupTitle)}
          </h3>
        </div>
        <button type="button" className={styles.textButton} onClick={onCancel}>
          {t("Cancel")}
        </button>
      </div>

      {/* One thing to do, then the list. The reasoning behind it read as a
          wall of text above the stops, so it waits behind "How this works";
          what is kept about the passenger stays in plain view. */}
      <p className={styles.helper}>
        {preselectFirst
          ? t(
              "Review the public stop you selected and confirm that it is suitable for this destination."
            )
          : t(phrases.choose)}
      </p>
      <details className={styles.setupDetails}>
        <summary>{t("How this works")}</summary>
        <p>
          {preselectFirst
            ? ""
            : `${t(
                "When location quality is good and a stop is reasonably close, the nearest stop is selected first. Otherwise you must choose manually."
              )} `}
          {t(phrases.backupAdvice)}
        </p>
      </details>
      <p className={styles.privacy}>
        {t(
          "Only public stop IDs and names are saved; your exact location is discarded."
        )}
      </p>

      <p className={styles.meta}>
        {preselectFirst
          ? t("Using the stop you selected manually")
          : Number.isFinite(accuracy)
            ? t("Location accuracy ±{accuracy}", {
                accuracy: formatAccuracy(accuracy),
              })
            : t("Location accuracy unavailable")}
        {!preselectFirst && !reliableLocation
          ? ` · ${t(
              "no stop was preselected — choose and confirm an arrival stop yourself"
            )}`
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
                  <strong><StopName stop={stop} /></strong>
                  <small>
                    {t("Stop {id}", { id: stop.id })} ·{" "}
                    {formatDistance(stop.distanceMeters)}
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
                {t("Main stop")}
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
          {t("Save {label}", { label })}
        </button>
      </div>
    </section>
  );
}

function journeyAction(place) {
  return t(PLACE_PHRASES[place.id].go);
}

function SharedPlaceImport({ place, replacing, onImport, onDismiss }) {
  const preset = PLACE_PRESETS.find((candidate) => candidate.id === place.id);
  if (!preset) return null;

  const label = placeLabel(preset);

  return (
    <section
      className={styles.importCard}
      aria-labelledby="shared-place-title"
    >
      <p className={styles.kicker}>{t("Shared place")}</p>
      <h3 id="shared-place-title">
        {replacing
          ? t("Replace {label}?", { label })
          : t("Add {label}?", { label })}
      </h3>
      <p className={styles.helper}>
        {t(
          "This link contains public Föli stop IDs and names, not an exact private address. Those stops can still reveal the general area of this place. The app cannot verify who created the link, so accept shared places only from someone you trust."
        )}
      </p>
      <div className={styles.importStops}>
        {place.stops.map((stop) => (
          <span key={stop.id}>
            <strong><StopName stop={stop} /></strong>
            <small>
              {t("Stop {id}", { id: stop.id })}
              {stop.id === place.primaryStopId ? ` · ${t("primary")}` : ""}
            </small>
          </span>
        ))}
      </div>
      <div className={styles.setupActions}>
        <button type="button" className={styles.primaryButton} onClick={onImport}>
          {replacing
            ? t("Replace {label}", { label })
            : t("Add {label}", { label })}
        </button>
        <button type="button" className={styles.textButton} onClick={onDismiss}>
          {t("Not now")}
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
  // The phrase, worded when shown, so it follows a language switch.
  const [shareFeedback, setShareFeedback] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const label = placeLabel(place);
  const resolvedStops = resolvePlaceStops(place, stops);
  const primaryStop =
    resolvedStops.find((stop) => stop.id === place.primaryStopId) ||
    resolvedStops[0];
  const backupCount = resolvedStops.length - 1;
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
          title: t("{label} · My Places", { label }),
          text: t("Add {label} to My Places", { label }),
          url,
        });
        setShareFeedback(msg("Link shared."));
        return;
      }

      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setShareFeedback(msg("Share link copied."));
        return;
      }
    } catch (error) {
      if (error?.name === "AbortError") return;
    }

    setShareUrl(url);
    setShareFeedback(msg("Copy the share link below."));
  };

  return (
    <article
      className={styles.placeCard}
      data-mobile-expanded={mobileExpanded ? "true" : "false"}
    >
      <button
        type="button"
        className={styles.mobileSummary}
        onClick={() =>
          setMobileExpanded((current) => {
            if (current) setShowDriver(false);
            return !current;
          })
        }
        aria-expanded={mobileExpanded}
      >
        <span className={styles.placeIcon} aria-hidden="true">
          {place.icon}
        </span>
        <span className={styles.mobileSummaryText}>
          <strong>{label}</strong>
          <small>
            {place.needsReview ? `${t("Needs review")} · ` : ""}
            <StopName stop={primaryStop} /> · {t("stop {id}", { id: primaryStop.id })}
          </small>
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
          <h3>{label}</h3>
          <p>
            {t("Main stop: {name} · stop {id}", {
              name: stopLabel(primaryStop),
              id: primaryStop.id,
            })}
          </p>
        </div>
      </div>

      {place.needsReview && (
        <p className={styles.reviewNotice} role="status">
          {t(
            "One or more saved stops no longer appear in the current Föli stop catalogue. Review this place before relying on it."
          )}
        </p>
      )}

      <div className={styles.placeActions}>
        {transitUrl ? (
          <a
            className={styles.goButton}
            href={transitUrl}
            target="_blank"
            rel="noreferrer"
            aria-label={t("{action} by public transit", {
              action: journeyAction(place),
            })}
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
          {t(PLACE_PHRASES[place.id].open)}
        </button>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={() => setShowDriver(true)}
        >
          {t("Show to driver")}
        </button>
      </div>

      {backupCount > 0 && (
        <details className={styles.backups}>
          <summary>
            {backupCount === 1
              ? t("1 backup stop")
              : t("{count} backup stops", { count: backupCount })}
          </summary>
          <div className={styles.backupList}>
            {resolvedStops.map((stop) => (
              <div key={stop.id} className={styles.backupRow}>
                <span>
                  <strong><StopName stop={stop} /></strong>
                  <small>{t("Stop {id}", { id: stop.id })}</small>
                </span>
                {stop.id === primaryStop.id ? (
                  <span className={styles.primaryBadge}>{t("Main stop")}</span>
                ) : (
                  <button
                    type="button"
                    className={styles.textButton}
                    onClick={() => onSetPrimaryStop(place.id, stop.id)}
                  >
                    {t("Make main stop")}
                  </button>
                )}
              </div>
            ))}
          </div>
        </details>
      )}

      <details className={styles.manage}>
        <summary>{t(PLACE_PHRASES[place.id].manage)}</summary>
        <p className={styles.sharePrivacyHint}>
          {t(PLACE_PHRASES[place.id].sharing)}
        </p>
        <div className={styles.manageActions}>
          <button
            type="button"
            className={styles.textButton}
            onClick={() => onReplace(place.id)}
          >
            {t("Replace using where I am now")}
          </button>
          <button
            type="button"
            className={styles.textButton}
            onClick={sharePlace}
          >
            {t("Share {label}", { label })}
          </button>
          <button
            type="button"
            className={styles.dangerButton}
            onClick={() => {
              if (window.confirm(t("Remove {label} from My Places?", { label }))) {
                onRemove(place.id);
              }
            }}
          >
            {t("Remove {label}", { label })}
          </button>
        </div>
        {shareFeedback && (
          <p className={styles.shareFeedback} role="status">
            {t(shareFeedback)}
          </p>
        )}
        {shareUrl && (
          <input
            className={styles.shareInput}
            aria-label={t("Share link for {label}", { label })}
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
  const label = placeLabel(preset);

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
          <strong>{label}</strong>
          <small>{t("Not set")}</small>
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
          <h3>{label}</h3>
          <p>{t("Save the stops you use, without typing an address.")}</p>
        </div>
        <div className={styles.emptyActions}>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => onStartSetup(preset.id)}
            disabled={status === "locating"}
            aria-busy={status === "locating"}
            aria-label={t(PLACE_PHRASES[preset.id].locate)}
          >
            {t("Use my location")}
          </button>
          {activeStop && (
            <button
              type="button"
              className={styles.textButton}
              onClick={() => onStartFromSelectedStop(preset.id)}
              aria-label={t(PLACE_PHRASES[preset.id].useStop, {
                name: stopLabel(activeStop),
              })}
            >
              {t("Use {name}", { name: stopLabel(activeStop) })}
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
  useLanguage();
  const [setupId, setSetupId] = useState("");
  const [setupCandidates, setSetupCandidates] = useState([]);
  const [setupAccuracy, setSetupAccuracy] = useState(null);
  const [setupPreselectFirst, setSetupPreselectFirst] = useState(false);
  const [status, setStatus] = useState("idle");
  // How to word the problem, not the words, so a language switch while it
  // shows rewords it.
  const [error, setError] = useState(null);
  const showError = (text) => setError({ text });

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
      showError(() =>
        coordinatesStatus === "loading"
          ? t("Stop locations are still loading. Try again in a moment.")
          : t("Stop locations are temporarily unavailable.")
      );
      return;
    }

    if (!navigator.geolocation) {
      showError(() => t("This browser does not support location access."));
      return;
    }

    setStatus("locating");
    setError(null);

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
        showError(() =>
          t(
            "This location appears outside Föli’s published service area. Choose a public stop manually instead."
          )
        );
        return;
      }

      const nearest = findNearestStops(stops, position, 3);

      if (nearest.length === 0) {
        throw new Error("No nearby stops found.");
      }

      const nearestMeters = nearest[0].distanceMeters;
      if (nearestMeters > MAX_SETUP_DISTANCE_METERS) {
        setStatus("idle");
        showError(() =>
          t(
            "The nearest Föli stop is {distance} away. Move closer to the place before saving it.",
            { distance: formatDistance(nearestMeters) }
          )
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
      showError(() => t(locationErrorMessage(locationError)));
    }
  };

  const startFromSelectedStop = (placeId) => {
    const preset = PLACE_PRESETS.find((candidate) => candidate.id === placeId);
    if (!preset || !activeStop) return;

    setError(null);
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
          <p className={styles.kicker}>{t("No address to remember")}</p>
          <h2 id="my-places-title">{t("My Places")}</h2>
          <p className={styles.description}>
            {t(
              "Save Home, School or Work as public stops — no address to type or remember."
            )}
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
          {error.text()}
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
          {t("Finding the closest Föli stops…")}
        </p>
      )}

      {/* Keyed by place, so a confirmation ticked for Home can never be
          carried into School's setup as if it had been given for School. */}
      {setupId && setupCandidates.length > 0 && (
        <SetupPlace
          key={setupId}
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
        {t(
          "Transit links open externally with only the public destination stop. Your starting location is not embedded in the link."
        )}
      </p>
    </section>
  );
}

export default MyPlaces;
