import styles from "./ConnectivityStatus.module.css";

function ConnectivityStatus({ online }) {
  if (online) return null;

  return (
    <aside className={styles.banner} role="status" aria-live="polite">
      <strong>Offline</strong>
      <span>
        Saved Safe Places and driver help still work. Live departures and
        external route planning need an internet connection.
      </span>
    </aside>
  );
}

export default ConnectivityStatus;
