import styles from "./BusStopDisplay.module.css";
import {
  formatClock,
  formatDue,
  formatServiceStatus,
  getDepartureTime,
} from "../utils/time";

const MAX_VISIBLE_DEPARTURES = 10;

function BusStopDisplay({
  stopId,
  stopName,
  arrivals,
  serverTime,
  loading,
  refreshing,
  error,
  onRefresh,
}) {
  const visibleArrivals = arrivals.slice(0, MAX_VISIBLE_DEPARTURES);
  const hasData = Boolean(stopName || arrivals.length);

  return (
    <section className={styles.board} aria-labelledby="departures-title">
      <header className={styles.header}>
        <div>
          <h1 id="departures-title" className={styles.stopName}>
            {stopName || (loading ? "Loading…" : `Stop ${stopId}`)}
          </h1>
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
          Refresh
        </button>
      </header>

      {error && hasData && (
        <p className={styles.staleNotice} role="status">
          Update failed · showing the last successful data
        </p>
      )}

      {loading && !hasData ? (
        <div className={styles.state} role="status">
          Loading departures…
        </div>
      ) : error && !hasData ? (
        <div className={styles.state} role="alert">
          <strong>Couldn’t load departures.</strong>
          <span>Check the stop number and try again.</span>
        </div>
      ) : visibleArrivals.length === 0 ? (
        <div className={styles.state} role="status">
          No upcoming departures for this stop.
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
              {visibleArrivals.map((arrival) => {
                const departureTime = getDepartureTime(arrival);
                const serviceStatus = formatServiceStatus(
                  arrival.monitored,
                  arrival.delay
                );

                return (
                  <tr
                    key={[
                      arrival.lineref,
                      arrival.destinationdisplay,
                      departureTime,
                    ].join("-")}
                  >
                    <td>
                      <span className={styles.lineBadge}>
                        {arrival.lineref || "—"}
                      </span>
                    </td>
                    <td className={styles.destination}>
                      {arrival.destinationdisplay || "Unknown destination"}
                      <span className={styles.tripMeta}>
                        {serviceStatus} · {formatClock(departureTime)}
                      </span>
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
    </section>
  );
}

export default BusStopDisplay;
