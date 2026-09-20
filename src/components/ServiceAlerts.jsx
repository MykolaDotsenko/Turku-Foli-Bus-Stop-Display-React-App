import styles from "./ServiceAlerts.module.css";
import { formatClock } from "../utils/time";

function ServiceAlerts({ alerts }) {
  if (alerts.length === 0) return null;

  return (
    <section className={styles.panel} aria-labelledby="service-alerts-title">
      <div className={styles.headingRow}>
        <div>
          <p className={styles.kicker}>Before you go</p>
          <h2 id="service-alerts-title" className={styles.heading}>
            Service updates
          </h2>
        </div>
        <span className={styles.count}>{alerts.length}</span>
      </div>

      <div className={styles.list}>
        {alerts.slice(0, 3).map((alert) => (
          <article
            key={alert.id}
            className={`${styles.alert} ${
              alert.type === "cancellation" ? styles.cancellation : ""
            }`}
          >
            <strong>{alert.title}</strong>
            {alert.type === "cancellation" ? (
              <p>
                {alert.line ? `Line ${alert.line}` : "A departure"}
                {alert.scheduledTime
                  ? ` · ${formatClock(alert.scheduledTime)}`
                  : ""}
                {alert.cause ? ` · ${alert.cause}` : ""}
              </p>
            ) : alert.message ? (
              <p>{alert.message}</p>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

export default ServiceAlerts;
