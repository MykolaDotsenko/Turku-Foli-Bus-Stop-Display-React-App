import { useMemo, useState } from "react";
import { placeLabel } from "../hooks/useSavedPlaces";
import { t, useLanguage } from "../i18n";
import { hasCoordinates } from "../utils/geo";
import { buildTransitDirectionsUrl } from "../utils/maps";
import SafePlaceDriverCard from "./SafePlaceDriverCard";
import styles from "./HomeRecovery.module.css";
import { stopLabel } from "../utils/stopNames";

// The request on the printed card is the driver's, so it is the same
// whichever language the app is in, as on the driver card.
const PRINTED_REQUEST_FINNISH =
  "Voitteko auttaa minua jäämään pois oikealla pysäkillä?";
const PRINTED_REQUEST_ENGLISH = "Could you help me get off at the right stop?";

function resolveStops(place, stops) {
  const byId = new Map(stops.map((stop) => [stop.id, stop]));

  return place.stops.map((savedStop) => ({
    ...savedStop,
    ...(byId.get(savedStop.id) || {}),
  }));
}

function HomeRecovery({ home, stops, online = true, onOpenStop }) {
  useLanguage();
  const [showDriver, setShowDriver] = useState(false);
  const [mobileOptionsOpen, setMobileOptionsOpen] = useState(false);
  const canPrint = typeof globalThis.print === "function";

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
  const label = placeLabel(home);

  return (
    <section
      className={styles.wrapper}
      data-mobile-options-open={mobileOptionsOpen ? "true" : "false"}
      aria-labelledby="home-recovery-title"
    >
      <div className={styles.copy}>
        <p className={styles.kicker}>{t("Travel recovery")}</p>
        <h2 id="home-recovery-title">{t("Need help getting home?")}</h2>
        <p className={styles.description}>
          {t("Travel help, not an emergency service.")}
        </p>
      </div>

      <div className={styles.destination}>
        <span className={styles.homeIcon} aria-hidden="true">
          {"⌂"}
        </span>
        <span>
          <strong>{label}</strong>
          <small>
            {stopLabel(primaryStop)} · {t("stop {id}", { id: primaryStop.id })}
          </small>
        </span>
      </div>

      {home.needsReview && (
        <p className={styles.status} role="status">
          {t(
            "Home needs review because a saved stop changed or disappeared from the current Föli catalogue."
          )}
        </p>
      )}

      <div className={styles.actions}>
        {transitUrl ? (
          <a
            className={styles.primaryAction}
            href={transitUrl}
            target="_blank"
            rel="noreferrer"
            aria-label={t("Get me Home by public transit")}
          >
            {t("Get me Home")}
          </a>
        ) : (
          <button
            type="button"
            className={styles.primaryAction}
            disabled
            aria-describedby="home-recovery-routing-status"
          >
            {t("Get me Home")}
          </button>
        )}

        <button
          type="button"
          className={styles.mobileOptionsToggle}
          aria-expanded={mobileOptionsOpen}
          onClick={() => setMobileOptionsOpen((current) => !current)}
        >
          {mobileOptionsOpen ? t("Fewer options") : t("Home options")}
        </button>

        <button
          type="button"
          className={styles.secondaryAction}
          onClick={() => onOpenStop(primaryStop.id)}
        >
          {t("Open Home stop")}
        </button>

        <button
          type="button"
          className={styles.secondaryAction}
          onClick={() => setShowDriver(true)}
        >
          {t("Show to driver")}
        </button>
      </div>

      {transitUrl && (
        <p className={styles.routeNote}>
          {t(
            "Opens Google Maps to this saved Home stop. Check the suggested itinerary before travelling."
          )}
        </p>
      )}

      {!transitUrl && (
        <p id="home-recovery-routing-status" className={styles.status}>
          {online
            ? t(
                "Transit directions are temporarily unavailable until public stop coordinates load. Your saved stop and driver card still work."
              )
            : t(
                "You’re offline. Your saved Home stop and driver card still work; connect to the internet for transit directions."
              )}
        </p>
      )}

      {backupStops.length > 0 && (
        <details className={styles.backups}>
          <summary>
            {backupStops.length > 1
              ? t("Other saved Home stops")
              : t("Other saved Home stop")}
          </summary>
          <p className={styles.backupHint}>
            {t(
              "If the usual stop is unavailable, choose another stop you approved for Home."
            )}
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
                    <strong>{stopLabel(stop)}</strong>
                    <small>{t("Stop {id}", { id: stop.id })}</small>
                  </span>
                  <div className={styles.backupActions}>
                    {backupTransitUrl && (
                      <a
                        href={backupTransitUrl}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={t(
                          "Route there: backup Home stop {name}, stop {id}, by public transit",
                          { name: stopLabel(stop), id: stop.id }
                        )}
                      >
                        {t("Route there")}
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => onOpenStop(stop.id)}
                    >
                      {t("Open stop")}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </details>
      )}

      <details className={styles.batteryBackup}>
        <summary>{t("Prepare for no battery")}</summary>
        <p>
          {t(
            "A web app cannot help after the phone powers off. Print or save a small Home backup card in advance so the destination still exists outside the phone. The card reveals the saved public Home stop area, so keep it only with the intended user."
          )}
        </p>
        {canPrint && (
          <button
            type="button"
            className={styles.printButton}
            onClick={() => globalThis.print()}
          >
            {t("Print / save Home backup card")}
          </button>
        )}
      </details>

      {/* Handed to a driver, so it must not read as a Föli document, and
          it keeps to words a child holding it can follow. The request is
          for the driver and never changes; the rest is in the passenger's
          language. */}
      <section className={styles.printCard} aria-hidden="true">
        <p className={styles.printKicker}>{t("Home backup card")}</p>
        <h2>{label}</h2>
        <p className={styles.printPrimary}>
          {stopLabel(primaryStop)}
          <span>{t("Stop {id}", { id: primaryStop.id })}</span>
        </p>
        {backupStops.length > 0 && (
          <div className={styles.printBackups}>
            <strong>{t("Backup stops")}</strong>
            {backupStops.map((stop) => (
              <p key={stop.id}>
                {stopLabel(stop)} · {t("Stop {id}", { id: stop.id })}
              </p>
            ))}
          </div>
        )}
        <p className={styles.printHelp} lang="fi">
          {PRINTED_REQUEST_FINNISH}
          <span lang="en">{PRINTED_REQUEST_ENGLISH}</span>
        </p>
        <p className={styles.printNote}>
          {t(
            "Show this card to a driver or trusted adult. This card contains public stop information, not a private home address."
          )}
        </p>
      </section>

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
