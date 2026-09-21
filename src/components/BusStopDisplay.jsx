import { Fragment, useMemo, useState } from "react";
import styles from "./BusStopDisplay.module.css";
import TripJourneyDetails from "./TripJourneyDetails";
import RideSetup from "./RideSetup";
import useClockTick from "../hooks/useClockTick";
import useTripEnrichment from "../hooks/useTripEnrichment";
import { distanceInMeters, formatDistance, hasCoordinates } from "../utils/geo";
import { accessibleRouteTextColor } from "../utils/routes";
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

function routeBadgeStyle(route) {
  if (!route?.color) return undefined;

  return {
    backgroundColor: route.color,
    color: accessibleRouteTextColor(route.color, route.textColor || "#ffffff"),
  };
}


function browserLanguages() {
  if (typeof navigator === "undefined") return ["en"];
  const languages = Array.isArray(navigator.languages)
    ? navigator.languages
    : [navigator.language];
  return languages.filter(Boolean);
}

function localizedDestination(arrival, preferredLanguages) {
  for (const language of preferredLanguages) {
    const base = String(language || "").toLowerCase().split("-")[0];
    if (base === "sv" && arrival.destinationdisplay_sv) {
      return arrival.destinationdisplay_sv;
    }
    if (base === "en" && arrival.destinationdisplay_en) {
      return arrival.destinationdisplay_en;
    }
  }

  return (
    arrival.destinationdisplay ||
    arrival.destinationdisplay_en ||
    arrival.destinationdisplay_sv ||
    ""
  );
}

function wheelchairLabel(value) {
  if (value === 1) return "Wheelchair accessible";
  if (value === 2) return "Wheelchair access not available";
  return "";
}

function BusStopDisplay({
  stopId,
  stopName,
  stop,
  stops = [],
  arrivals,
  routesByShortName,
  serverTime,
  receivedAtMs,
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
      const departureTime = getDepartureTime(arrival);
      return (
        Number.isFinite(departureTime) &&
        departureTime >= referenceTime - DEPARTED_GRACE_SECONDS
      );
    })
    .sort(
      (a, b) =>
        getDepartureTime(a) - getDepartureTime(b)
    )
    .slice(0, MAX_VISIBLE_DEPARTURES);
  const hasData = Boolean(stopName || arrivals.length);
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
                const departureTime = getDepartureTime(arrival);
                const route = routesByShortName?.get(arrival.lineref);
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
                const tripDetails = arrival.tripref
                  ? tripDetailsById.get(arrival.tripref)
                  : null;
                const destination =
                  localizedDestination(arrival, preferredLanguages) ||
                  tripDetails?.headsign ||
                  "Unknown destination";
                const accessibility = wheelchairLabel(
                  tripDetails?.wheelchairAccessible
                );

                const rowKey = [
                  arrival.lineref,
                  arrival.tripref || arrival.destinationdisplay,
                  departureTime,
                  index,
                ].join("-");
                const rideKey = arrival.tripref
                  ? `${arrival.tripref}-${departureTime}`
                  : "";
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
                        <>
                          <TripJourneyDetails
                            tripId={arrival.tripref}
                            currentStopId={stopId}
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
                                ? "Close get-off alerts"
                                : "Alert me when to get off"}
                          </button>
                        </>
                      )}
                    </td>
                    <td className={styles.due}>
                      {formatDue(departureTime, effectiveServerTime * 1000)}
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
