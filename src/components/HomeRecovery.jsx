import { useMemo, useState } from "react";
import { hasCoordinates } from "../utils/geo";
import { buildTransitDirectionsUrl } from "../utils/maps";
import SafePlaceDriverCard from "./SafePlaceDriverCard";
import styles from "./HomeRecovery.module.css";

function resolveStops(place, stops) {
  const byId = new Map(stops.map((stop) => [stop.id, stop]));

  return place.stops.map((savedStop) => ({
    ...savedStop,
    ...(byId.get(savedStop.id) || {}),
  }));
}

function HomeRecovery({ home, stops, online = true, onOpenStop }) {
  const [showDriver, setShowDriver] = useState(false);

  const resolvedStops = useMemo(
    () => (home ? resolveStops(home, stops) : []),
    [home, stops]
  );

  if (!home || resolvedStops.length === 0) return null;

  const primaryStop =
    resolvedStops.find((stop) => stop.id === home.primaryStopId) ||
    resolvedStops[0];
  const backupStops = resolvedStops.filter(
    (stop) => stop.id !== primaryStop.id
  );
  const transitUrl =
    online && hasCoordinates(primaryStop)
      ? buildTransitDirectionsUrl(primaryStop)
      : "";

  return (
    <section className={styles.wrapper} aria-labelledby="home-recovery-title">
      <div className={styles.copy}>
        <p className={styles.kicker}>Travel recovery</p>
        <h2 id="home-recovery-title">Lost or unsure? Get home from here.</h2>
        <p className={styles.description}>
          Use your saved Safe Arrival Zone. This is travel help, not an
          emergency service.
        </p>
      </div>

      <div className={styles.destination}>
        <span className={styles.homeIcon} aria-hidden="true">
          ⌂
        </span>
        <span>
          <strong>Home</strong>
          <small>
            {primaryStop.name} · stop {primaryStop.id}
          </small>
        </span>
      </div>

      <div className={styles.actions}>
        {transitUrl ? (
          <a
            className={styles.primaryAction}
            href={transitUrl}
            target="_blank"
            rel="noreferrer"
            aria-label="Get me Home by public transit"
          >
            Get me Home
          </a>
        ) : (
          <button
            type="button"
            className={styles.primaryAction}
            disabled
            aria-describedby="home-recovery-routing-status"
          >
            Get me Home
          </button>
        )}

        <button
          type="button"
          className={styles.secondaryAction}
          onClick={() => onOpenStop(primaryStop.id)}
        >
          Open Home stop
        </button>

        <button
          type="button"
          className={styles.secondaryAction}
          onClick={() => setShowDriver(true)}
        >
          Show driver
        </button>
      </div>

      {!transitUrl && (
        <p id="home-recovery-routing-status" className={styles.status}>
          {online
            ? "Transit directions are temporarily unavailable until public stop coordinates load. Your saved stop and driver card still work."
            : "You’re offline. Your saved Home stop and driver card still work; connect to the internet for transit directions."}
        </p>
      )}

      {backupStops.length > 0 && (
        <details className={styles.backups}>
          <summary>
            Other safe Home stop{backupStops.length > 1 ? "s" : ""}
          </summary>
          <p className={styles.backupHint}>
            If the usual stop is unavailable, choose another stop that was
            saved as safe.
          </p>
          <div className={styles.backupList}>
            {backupStops.map((stop) => {
              const backupTransitUrl =
                online && hasCoordinates(stop)
                  ? buildTransitDirectionsUrl(stop)
                  : "";

              return (
                <div key={stop.id} className={styles.backupRow}>
                  <span>
                    <strong>{stop.name}</strong>
                    <small>Stop {stop.id}</small>
                  </span>
                  <div className={styles.backupActions}>
                    {backupTransitUrl && (
                      <a
                        href={backupTransitUrl}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`Get to backup Home stop ${stop.name}, stop ${stop.id}, by public transit`}
                      >
                        Route there
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => onOpenStop(stop.id)}
                    >
                      Open stop
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </details>
      )}

      {showDriver && (
        <SafePlaceDriverCard
          place={home}
          primaryStop={primaryStop}
          idPrefix="recovery"
          onClose={() => setShowDriver(false)}
        />
      )}
    </section>
  );
}

export default HomeRecovery;
