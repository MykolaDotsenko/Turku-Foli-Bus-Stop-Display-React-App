import { Fragment, useMemo, useState } from "react";
import styles from "./BusStopDisplay.module.css";
import TripJourneyDetails from "./TripJourneyDetails";
import RideSetup from "./RideSetup";
import useClockTick from "../hooks/useClockTick";
import useTripEnrichment from "../hooks/useTripEnrichment";
import { distanceInMeters, formatDistance, hasCoordinates } from "../utils/geo";
import { accessibleRouteTextColor, contrastRatio } from "../utils/routes";
import {
  advanceServerTime,
  dataAgeSeconds,
  elapsedSince,
  formatClock,
  formatDue,
  formatElapsedAge,
  formatServiceStatus,
  getDepartureTime,
} from "../utils/time";

const MAX_VISIBLE_DEPARTURES = 10;
const DEPARTED_GRACE_SECONDS = 30;

function vehicleProximity(arrival, stop, route, serverTime) {
  if (!arrival.monitored) return "";

  const vehicle = route?.type === 4 ? "Waterbus" : "Bus";
  const ageSeconds = dataAgeSeconds(arrival.recordedattime, serverTime);

  if (
    arrival.vehicleatstop === true &&
    (ageSeconds === null || ageSeconds <= 120)
  ) {
    return `${vehicle} at stop · board now`;
  }

  if (
    !hasCoordinates(stop) ||
    !hasCoordinates({ lat: arrival.latitude, lon: arrival.longitude })
  ) {
    return "";
  }

  const distance = distanceInMeters(
    { lat: arrival.latitude, lon: arrival.longitude },
    stop
  );
  if (!Number.isFinite(distance)) return "";

  if (ageSeconds !== null && ageSeconds > 120) {
    return `Last ${vehicle.toLowerCase()} position ≈${formatDistance(
      distance
    )} from stop · ${Math.max(2, Math.round(ageSeconds / 60))} min old`;
  }

  if (distance <= 50) return `${vehicle} at or near stop`;
  if (distance <= 250) {
    return `${vehicle} nearby · ≈${formatDistance(distance)} from stop`;
  }

  return `${vehicle} ≈${formatDistance(distance)} from stop`;
}

// A departure keeps one identity across refreshes. The live estimate moves on
// nearly every poll and the index moves whenever an earlier bus leaves, so a
// row keyed on either was remounted: an open "Next stops" list or get-off
// setup closed mid-choice, taking the chosen stop with it. The planned time
// stays put, and still tells two visits of one looping trip apart. The stop
// is part of it too: a neighbouring stop can list the same trip under the
// same planned minute, and its row must not inherit this one's open panels.
function departureKeys(arrivals, referenceTime, stopId) {
  const seen = new Map();

  return arrivals.map((arrival) => {
    const planned =
      Number(arrival.aimeddeparturetime) ||
      Number(arrival.aimedarrivaltime) ||
      getDepartureTime(arrival, referenceTime);
    const identity = [
      stopId,
      arrival.lineref,
      arrival.tripref || arrival.destinationdisplay,
      planned,
    ].join("-");
    // Identical rows would be a feed quirk, but keys must still be unique.
    const repeat = seen.get(identity) || 0;
    seen.set(identity, repeat + 1);

    return repeat === 0 ? identity : `${identity}#${repeat}`;
  });
}

function routeBadgeStyle(route) {
  if (!route?.color) return undefined;

  // A route colour close to white (line 1's yellow is 1.07:1 against the
  // row) leaves the badge with no edge, so it gets a hairline outline.
  const blendsIntoRow = (contrastRatio(route.color, "#ffffff") ?? 21) < 1.5;

  return {
    backgroundColor: route.color,
    color: accessibleRouteTextColor(route.color, route.textColor || "#ffffff"),
    ...(blendsIntoRow
      ? { boxShadow: "inset 0 0 0 1px rgba(0, 0, 0, 0.22)" }
      : {}),
  };
}


function browserLanguages() {
  if (typeof navigator === "undefined") return ["en"];
  const languages = Array.isArray(navigator.languages)
    ? navigator.languages
    : [navigator.language];
  return languages.filter(Boolean);
}

// The row leads with the name on the bus's own sign, which is the Finnish one.
// A reader whose language Föli also names the destination in gets that name
// beside it, never instead of it: "Harbour" alone gave an English reader
// nothing to match against the "Satama" on the bus pulling in.
function destinationNames(arrival, preferredLanguages) {
  const sign =
    arrival.destinationdisplay ||
    arrival.destinationdisplay_en ||
    arrival.destinationdisplay_sv ||
    "";

  for (const language of preferredLanguages) {
    const base = String(language || "").toLowerCase().split("-")[0];
    // The sign is already in a Finnish reader's language.
    if (base === "fi") break;

    const translated =
      base === "sv"
        ? arrival.destinationdisplay_sv
        : base === "en"
          ? arrival.destinationdisplay_en
          : "";
    if (!translated) continue;

    const repeatsSign =
      translated.trim().toLocaleLowerCase() === sign.trim().toLocaleLowerCase();
    return { sign, translation: repeatsSign ? "" : translated, lang: base };
  }

  return { sign, translation: "", lang: "" };
}

function wheelchairLabel(value) {
  if (value === 1) return "Wheelchair accessible";
  if (value === 2) return "Not wheelchair accessible";
  return "";
}

// "Today 19:15" and "Tomorrow 06:30" set in the countdown's size would take
// half a phone's width from the destination, so the day sits above the time.
function DueLabel({ label }) {
  const match = /^(Today|Tomorrow|Mon|Tue|Wed|Thu|Fri|Sat|Sun) (.+)$/.exec(label);
  if (!match) return label;

  return (
    <>
      <span className={styles.dueDay}>{match[1]}</span> {match[2]}
    </>
  );
}

function BusStopDisplay({
  stopId,
  stopName,
  stop,
  stops = [],
  arrivals,
  routesById,
  routesByShortName,
  serverTime,
  receivedAtMs,
  realtimeAvailable,
  scheduleAvailable,
  scheduleFailed = false,
  scheduleIncomplete = false,
  loading,
  refreshing,
  error,
  onRefresh,
  isFavorite,
  onToggleFavorite,
  placesById,
  onStartRide,
  activeRideTripRef = "",
}) {
  // Keeps due times, freshness and the departed-row filter counting between
  // the 30-second provider refreshes instead of freezing at the last payload.
  const nowMs = useClockTick(10_000);
  const effectiveServerTime =
    advanceServerTime(serverTime, receivedAtMs, nowMs) ??
    Math.floor(nowMs / 1000);
  const receiptAgeSeconds = elapsedSince(receivedAtMs, nowMs);
  const dataIsStale =
    receiptAgeSeconds !== null && receiptAgeSeconds > 120;
  const referenceTime = effectiveServerTime;
  const visibleArrivals = [...arrivals]
    .filter((arrival) => {
      const departureTime = getDepartureTime(arrival, referenceTime);
      return (
        Number.isFinite(departureTime) &&
        departureTime >= referenceTime - DEPARTED_GRACE_SECONDS
      );
    })
    .sort(
      (a, b) =>
        getDepartureTime(a, referenceTime) - getDepartureTime(b, referenceTime)
    )
    .slice(0, MAX_VISIBLE_DEPARTURES);
  // Whether this stop has had a departure answer at all, fresh or saved. The
  // stop's name is not one: the catalogue names the stop long before its board
  // first loads, and counting it said "No upcoming departures" while loading,
  // and again when the load failed.
  const hasData = arrivals.length > 0 || Number(receivedAtMs) > 0;
  const realtimeCount = visibleArrivals.filter(
    (arrival) => arrival.monitored
  ).length;
  const tripDetailsById = useTripEnrichment(visibleArrivals);
  const stopsById = useMemo(
    () => new Map(stops.map((candidate) => [candidate.id, candidate])),
    [stops]
  );
  const preferredLanguages = useMemo(browserLanguages, []);
  const [rideCandidateKey, setRideCandidateKey] = useState("");
  // An open setup belongs to the stop it was opened at, so it is dropped the
  // moment the stop changes and coming back later does not reopen it. The
  // board itself stays mounted: remounting it for a stop change dropped
  // keyboard focus and the live region that announces the stop.
  const [candidateStopId, setCandidateStopId] = useState(stopId);
  if (candidateStopId !== stopId) {
    setCandidateStopId(stopId);
    setRideCandidateKey("");
  }
  const rowKeys = departureKeys(visibleArrivals, referenceTime, stopId);

  return (
    <section
      className={styles.board}
      aria-labelledby="departures-title"
      aria-busy={loading || refreshing}
    >
      <header className={styles.header}>
        <div className={styles.stopHeading}>
          <div className={styles.stopTitleRow}>
            <h1 id="departures-title" className={styles.stopName}>
              {stopName || (loading ? "Loading…" : `Stop ${stopId}`)}
            </h1>
            {stopName && (
              <button
                type="button"
                className={styles.favoriteButton}
                onClick={onToggleFavorite}
                aria-pressed={isFavorite}
                aria-label={
                  isFavorite
                    ? `Remove ${stopName} from favorites`
                    : `Save ${stopName} to favorites`
                }
                title={isFavorite ? "Remove favorite" : "Save favorite"}
              >
                <span aria-hidden="true">{isFavorite ? "★" : "☆"}</span>
              </button>
            )}
          </div>
          <p className={styles.stopMeta} aria-live="polite">
            Stop {stopId}
            {serverTime ? ` · Updated ${formatClock(serverTime)}` : ""}
            {receiptAgeSeconds !== null && receiptAgeSeconds >= 60
              ? ` · ${formatElapsedAge(receiptAgeSeconds)}`
              : ""}
            {refreshing ? " · Refreshing…" : ""}
          </p>
        </div>

        <button
          type="button"
          className={styles.refreshButton}
          onClick={onRefresh}
          disabled={loading || refreshing}
        >
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </header>

      {visibleArrivals.length > 0 && (
        <div className={styles.summary} aria-label="Departure data summary">
          <span>{visibleArrivals.length} upcoming</span>
          <span>
            <strong>{realtimeCount}</strong> realtime
          </span>
          <span>{visibleArrivals.length - realtimeCount} scheduled</span>
        </div>
      )}

      {(error || dataIsStale) && hasData && (
        <p className={styles.staleNotice} role="status">
          {error ? "Live update failed" : "Live data is getting old"}
          {receiptAgeSeconds !== null
            ? ` · last successful update ${formatElapsedAge(receiptAgeSeconds)}`
            : ""}
        </p>
      )}

      {scheduleAvailable &&
        visibleArrivals.length > 0 &&
        realtimeCount === 0 && (
          <p className={styles.staleNotice} role="status">
            {realtimeAvailable === false
              ? "Live updates are unavailable · showing scheduled Föli times."
              : "No live departure is published right now · showing the next scheduled Föli times."}
            {scheduleIncomplete
              ? " Later departures could not be checked, so more buses may run after these."
              : ""}
          </p>
        )}

      {loading && !hasData ? (
        <div className={styles.state} role="status">
          <span className={styles.stateKicker}>Connecting to Föli</span>
          <strong>Loading departures…</strong>
        </div>
      ) : error && !hasData ? (
        <div className={styles.state} role="alert">
          <strong>Couldn’t load departures.</strong>
          <span>Check the stop number or connection and try again.</span>
          <button type="button" className={styles.retryButton} onClick={onRefresh}>
            Try again
          </button>
        </div>
      ) : visibleArrivals.length === 0 && scheduleFailed ? (
        // The live feed only looks an hour or so ahead. With the timetable
        // unread, an empty board is not "no more buses".
        <div className={styles.state} role="status">
          <strong>No live departures right now.</strong>
          <span>
            The timetable could not be checked just now, so later buses may
            still run.
          </span>
          <button type="button" className={styles.retryButton} onClick={onRefresh}>
            Try again
          </button>
        </div>
      ) : visibleArrivals.length === 0 ? (
        <div className={styles.state} role="status">
          <strong>No upcoming departures.</strong>
          <span>Try refreshing or choosing another nearby stop.</span>
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Line</th>
                <th scope="col">Destination</th>
                <th scope="col">Due</th>
              </tr>
            </thead>
            <tbody>
              {visibleArrivals.map((arrival, index) => {
                const departureTime = getDepartureTime(arrival, referenceTime);
                const tripDetails = arrival.tripref
                  ? tripDetailsById.get(arrival.tripref)
                  : null;
                const route =
                  (tripDetails?.routeId
                    ? routesById?.get(tripDetails.routeId)
                    : null) ||
                  routesByShortName?.get(arrival.lineref);
                const serviceStatus = formatServiceStatus(
                  arrival.monitored,
                  arrival.delay,
                  arrival.recordedattime,
                  effectiveServerTime
                );
                const proximity = vehicleProximity(
                  arrival,
                  stop,
                  route,
                  effectiveServerTime
                );
                const destinationName = destinationNames(
                  arrival,
                  preferredLanguages
                );
                const destination =
                  destinationName.sign ||
                  tripDetails?.headsign ||
                  "Unknown destination";
                const accessibility = wheelchairLabel(
                  tripDetails?.wheelchairAccessible
                );

                const rowKey = rowKeys[index];
                const rideKey = arrival.tripref ? rowKey : "";
                const rideSetupOpen =
                  Boolean(rideKey) && rideCandidateKey === rideKey;
                const sameRideActive =
                  Boolean(activeRideTripRef) &&
                  activeRideTripRef === arrival.tripref;

                return (
                  <Fragment key={rowKey}>
                  <tr>
                    <td>
                      <span
                        className={styles.lineBadge}
                        style={routeBadgeStyle(route)}
                        title={route?.longName || undefined}
                      >
                        {arrival.lineref || "—"}
                      </span>
                    </td>
                    <td className={styles.destination}>
                      {destination}
                      {destinationName.translation && (
                        <span
                          className={styles.destinationTranslation}
                          lang={destinationName.lang}
                        >
                          {destinationName.translation}
                        </span>
                      )}
                      <span className={styles.tripMeta}>
                        {serviceStatus} · {formatClock(departureTime)}
                      </span>
                      {accessibility && (
                        <span
                          className={styles.accessibility}
                          data-accessible={
                            tripDetails?.wheelchairAccessible === 1
                              ? "true"
                              : "false"
                          }
                        >
                          {tripDetails?.wheelchairAccessible === 1 ? "♿ " : ""}
                          {accessibility}
                        </span>
                      )}
                      {proximity && (
                        <span className={styles.proximity}>{proximity}</span>
                      )}
                      {arrival.tripref && (
                        <div className={styles.rowActions}>
                          <TripJourneyDetails
                            tripId={arrival.tripref}
                            currentStopId={stopId}
                            aimedDepartureTime={arrival.aimeddeparturetime}
                            stopsById={stopsById}
                          />
                          <button
                            type="button"
                            className={styles.rideButton}
                            disabled={sameRideActive}
                            aria-expanded={rideSetupOpen}
                            onClick={() =>
                              setRideCandidateKey((current) =>
                                current === rideKey ? "" : rideKey
                              )
                            }
                          >
                            {sameRideActive
                              ? "Ride Mode active"
                              : rideSetupOpen
                                ? "Close get-off setup"
                                : "Alert me when to get off"}
                          </button>
                        </div>
                      )}
                    </td>
                    <td className={styles.due}>
                      <DueLabel
                        label={formatDue(
                          departureTime,
                          effectiveServerTime * 1000
                        )}
                      />
                    </td>
                  </tr>
                  {rideSetupOpen && !sameRideActive && (
                    <tr className={styles.rideSetupRow}>
                      <td colSpan={3}>
                        <RideSetup
                          arrival={arrival}
                          currentStopId={stopId}
                          currentStopName={stopName}
                          stopsById={stopsById}
                          placesById={placesById}
                          routesById={routesById}
                          onCancel={() => setRideCandidateKey("")}
                          onStart={(config) => {
                            onStartRide?.(config);
                            setRideCandidateKey("");
                          }}
                        />
                      </td>
                    </tr>
                  )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {visibleArrivals.length > 0 && (
        <details className={styles.legend}>
          <summary>About live estimates</summary>
          <p>
            Live times are estimates from vehicle data. Vehicle distance is a
            straight-line estimate from the latest reported position. Scheduled
            means no current realtime feed is available for that trip.
          </p>
        </details>
      )}
    </section>
  );
}

export default BusStopDisplay;
