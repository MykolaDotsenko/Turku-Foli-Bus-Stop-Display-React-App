import styles from "./BusStopDisplay.module.css";
import { formatClock, formatDelay, formatDue } from "../utils/time";

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

  return (
    <section className={styles.board} aria-labelledby="departures-title">
      <header className={styles.header}>
        <div>
          <p className={styles.stopId}>Stop {stopId}</p>
          <h2 id="departures-title" className={styles.stopName}>
            {stopName || (loading ? "Loading stop…" : "Departures")}
          </h2>
          <p className={styles.updated} aria-live="polite">
            {serverTime
              ? `Updated ${formatClock(serverTime)}`
              : "Waiting for real-time data"}
            {refreshing ? " · refreshing…" : ""}
          </p>
        </div>

        <button
          type="button"
          className={styles.refreshButton}
          onClick={onRefresh}
          disabled={loading || refreshing}
          aria-label="Refresh departure data"
        >
          Refresh
        </button>
      </header>

      {error && (
        <div className={styles.warning} role="status">
          <strong>Could not refresh live data.</strong>
          <span>{error} Showing the latest available information when possible.</span>
        </div>
      )}

      {loading && arrivals.length === 0 ? (
        <div className={styles.loading} role="status">
          Loading live departures…
        </div>
      ) : visibleArrivals.length === 0 ? (
        <div className={styles.empty} role="status">
          No upcoming departures are currently available for this stop.
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Line</th>
                <th scope="col">Destination</th>
                <th scope="col">Due</th>
                <th scope="col">Expected</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {visibleArrivals.map((arrival) => {
                const expected =
                  arrival.expectedarrivaltime || arrival.aimedarrivaltime;
                const delay = formatDelay(arrival.delay);

                return (
                  <tr
                    key={[
                      arrival.lineref,
                      arrival.destinationdisplay,
                      expected,
                    ].join("-")}
                  >
                    <td>
                      <span className={styles.lineBadge}>
                        {arrival.lineref || "—"}
                      </span>
                    </td>
                    <td className={styles.destination}>
                      {arrival.destinationdisplay || "Unknown destination"}
                      <span className={styles.realtime}>
                        {arrival.monitored ? "Real-time" : "Scheduled"}
                      </span>
                    </td>
                    <td className={styles.due}>{formatDue(expected)}</td>
                    <td>{formatClock(expected)}</td>
                    <td>
                      <span
                        className={
                          delay === "On time" ? styles.onTime : styles.delay
                        }
                      >
                        {delay}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className={styles.disclaimer}>
        Real-time arrival estimates can change with traffic, vehicle data
        availability, and other operating conditions.
      </p>
    </section>
  );
}

export default BusStopDisplay;
