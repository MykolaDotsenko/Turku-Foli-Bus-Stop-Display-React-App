import styles from "./BusStopDisplay.module.css";
import { distanceInMeters, formatDistance, hasCoordinates } from "../utils/geo";
import { accessibleRouteTextColor } from "../utils/routes";
import {
  dataAgeSeconds,
  formatClock,
  formatDue,
  formatServiceStatus,
  getDepartureTime,
} from "../utils/time";

const MAX_VISIBLE_DEPARTURES = 10;

function vehicleProximity(arrival, stop, route, serverTime) {
  if (
    !arrival.monitored ||
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

  const vehicle = route?.type === 4 ? "Waterbus" : "Bus";
  const ageSeconds = dataAgeSeconds(arrival.recordedattime, serverTime);

  if (ageSeconds !== null && ageSeconds > 120) {
    return `Last ${vehicle.toLowerCase()} position ≈${formatDistance(
      distance
    )} from stop · ${Math.max(2, Math.round(ageSeconds / 60))} min old`;
  }

  if (distance <= 50) return `${vehicle} at or near stop`;
  if (distance <= 250) {
    return `${vehicle} approaching · ≈${formatDistance(distance)} away`;
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

function BusStopDisplay({
  stopId,
  stopName,
  stop,
  arrivals,
  routesByShortName,
  serverTime,
  loading,
  refreshing,
  error,
  onRefresh,
  isFavorite,
  onToggleFavorite,
}) {
  const visibleArrivals = [...arrivals]
    .sort(
      (a, b) =>
        (getDepartureTime(a) ?? Infinity) -
        (getDepartureTime(b) ?? Infinity)
    )
    .slice(0, MAX_VISIBLE_DEPARTURES);
  const hasData = Boolean(stopName || arrivals.length);
  const liveCount = visibleArrivals.filter(
    (arrival) => arrival.monitored
  ).length;

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
            <strong>{liveCount}</strong> live
          </span>
          <span>{visibleArrivals.length - liveCount} scheduled</span>
        </div>
      )}

      {error && hasData && (
        <p className={styles.staleNotice} role="status">
          Update failed · showing the last successful data
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
                  serverTime
                );
                const proximity = vehicleProximity(arrival, stop, route, serverTime);

                return (
                  <tr
                    key={[
                      arrival.lineref,
                      arrival.destinationdisplay,
                      departureTime,
                      index,
                    ].join("-")}
                  >
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
                      {arrival.destinationdisplay || "Unknown destination"}
                      <span className={styles.tripMeta}>
                        {serviceStatus} · {formatClock(departureTime)}
                      </span>
                      {proximity && (
                        <span className={styles.proximity}>{proximity}</span>
                      )}
                    </td>
                    <td className={styles.due}>
                      {formatDue(departureTime)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {visibleArrivals.length > 0 && (
        <p className={styles.legend}>
          Live times are estimates from vehicle data. Vehicle distance is a
          straight-line estimate from the latest reported position. Scheduled
          means no current realtime feed is available for that trip.
        </p>
      )}
    </section>
  );
}

export default BusStopDisplay;
