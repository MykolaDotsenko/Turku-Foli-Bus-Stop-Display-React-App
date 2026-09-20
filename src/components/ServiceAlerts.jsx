import { useState } from "react";
import styles from "./ServiceAlerts.module.css";
import { formatClock } from "../utils/time";

const DEFAULT_VISIBLE_ALERTS = 4;

function humanizeCode(value) {
  if (!value) return "";
  return String(value)
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
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
          {alert.information && (
            <details className={styles.details}>
              <summary>Show details</summary>
              <p>{alert.information}</p>
            </details>
          )}
        </>
      )}
    </article>
  );
}

function ServiceAlerts({ alerts }) {
  const [expanded, setExpanded] = useState(false);

  if (alerts.length === 0) return null;

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
