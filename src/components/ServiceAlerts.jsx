import { useState } from "react";
import styles from "./ServiceAlerts.module.css";
import { elapsedSince, formatClock, formatElapsedAge } from "../utils/time";

const DEFAULT_VISIBLE_ALERTS = 4;
const STALE_ALERT_CHECK_SECONDS = 10 * 60;

function humanizeCode(value) {
  if (!value) return "";
  return String(value)
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatValidity(validity) {
  if (!validity?.end) return "";

  try {
    const formatter = new Intl.DateTimeFormat(undefined, {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
    return `Valid until ${formatter.format(new Date(validity.end * 1000))}`;
  } catch {
    return "";
  }
}

function AlertItem({ alert }) {
  const isCancellation = alert.type === "cancellation";
  const isEmergency = alert.type === "emergency";
  const isGlobal = alert.type === "global";

  return (
    <article
      className={[
        styles.alert,
        isCancellation ? styles.cancellation : "",
        isEmergency ? styles.emergency : "",
        isGlobal ? styles.global : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className={styles.alertHeader}>
        <strong>{alert.title}</strong>
        {!isCancellation && alert.effect && (
          <span className={styles.effectBadge}>{alert.effectLabel}</span>
        )}
      </div>

      {isCancellation ? (
        <p>
          {alert.line ? `Line ${alert.line}` : "A departure"}
          {alert.scheduledTime ? ` · ${formatClock(alert.scheduledTime)}` : ""}
          {alert.cause ? ` · ${humanizeCode(alert.cause)}` : ""}
        </p>
      ) : (
        <>
          {alert.routeNames?.length > 0 && (
            <p className={styles.scope}>
              Affects line{alert.routeNames.length > 1 ? "s" : ""}{" "}
              {alert.routeNames.join(", ")}
            </p>
          )}
          {isGlobal && (
            <p className={styles.scope}>Applies across Föli services</p>
          )}
          {alert.message && <p>{alert.message}</p>}
          {formatValidity(alert.validity) && (
            <p className={styles.validity}>{formatValidity(alert.validity)}</p>
          )}
          {(alert.information || alert.images?.length > 0) && (
            <details className={styles.details}>
              <summary>
                {alert.images?.length > 0
                  ? "View disruption details"
                  : "Show details"}
              </summary>
              {alert.information && <p>{alert.information}</p>}
              {alert.images?.length > 0 && (
                <div className={styles.mediaGrid}>
                  {alert.images.map((image, index) => (
                    <a
                      key={`${image.url}-${index}`}
                      className={styles.mediaLink}
                      href={image.url}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={image.title || `Open image for ${alert.title}`}
                    >
                      <img
                        src={image.url}
                        alt={image.title || `${alert.title} illustration`}
                        loading="lazy"
                        decoding="async"
                        referrerPolicy="no-referrer"
                      />
                      <span>{image.title || "Open full image"}</span>
                    </a>
                  ))}
                </div>
              )}
            </details>
          )}
        </>
      )}
    </article>
  );
}

function ServiceAlerts({ alerts, error = false, receivedAtMs = null }) {
  const [expanded, setExpanded] = useState(false);
  const receiptAgeSeconds = elapsedSince(receivedAtMs);
  const stale =
    receiptAgeSeconds !== null &&
    receiptAgeSeconds > STALE_ALERT_CHECK_SECONDS;

  if (alerts.length === 0 && !error && !stale) return null;

  if (alerts.length === 0) {
    return (
      <section
        className={`${styles.panel} ${styles.unavailablePanel}`}
        aria-labelledby="service-alerts-title"
      >
        <div className={styles.headingRow}>
          <div>
            <p className={styles.kicker}>Before you go</p>
            <h2 id="service-alerts-title" className={styles.heading}>
              Service update check unavailable
            </h2>
          </div>
        </div>
        <p className={styles.feedStatus} role="status">
          Föli disruption data could not be confirmed
          {receiptAgeSeconds !== null
            ? ` · last checked ${formatElapsedAge(receiptAgeSeconds)}`
            : ""}.
          Live departure data may still work separately.
        </p>
      </section>
    );
  }

  const emergency = alerts.some((alert) => alert.type === "emergency");
  const hasMore = alerts.length > DEFAULT_VISIBLE_ALERTS;
  const visibleAlerts = expanded
    ? alerts
    : alerts.slice(0, DEFAULT_VISIBLE_ALERTS);

  return (
    <section
      className={`${styles.panel} ${emergency ? styles.emergencyPanel : ""}`}
      aria-labelledby="service-alerts-title"
    >
      <div className={styles.headingRow}>
        <div>
          <p className={styles.kicker}>
            {emergency ? "Important now" : "Before you go"}
          </p>
          <h2 id="service-alerts-title" className={styles.heading}>
            {emergency ? "Emergency notice" : "Service updates"}
          </h2>
        </div>
        <span className={styles.count} aria-label={`${alerts.length} service updates`}>
          {alerts.length}
        </span>
      </div>

      {(error || stale) && (
        <p className={styles.feedStatus} role="status">
          {error ? "Update check failed" : "Service update check is getting old"}
          {receiptAgeSeconds !== null
            ? ` · last checked ${formatElapsedAge(receiptAgeSeconds)}`
            : ""}
        </p>
      )}

      <div className={styles.list}>
        {visibleAlerts.map((alert) => (
          <AlertItem key={alert.id} alert={alert} />
        ))}
      </div>

      {hasMore && (
        <button
          type="button"
          className={styles.moreButton}
          onClick={() => setExpanded((current) => !current)}
          aria-expanded={expanded}
        >
          {expanded
            ? "Show fewer updates"
            : `Show ${alerts.length - DEFAULT_VISIBLE_ALERTS} more update${
                alerts.length - DEFAULT_VISIBLE_ALERTS === 1 ? "" : "s"
              }`}
        </button>
      )}
    </section>
  );
}

export default ServiceAlerts;
