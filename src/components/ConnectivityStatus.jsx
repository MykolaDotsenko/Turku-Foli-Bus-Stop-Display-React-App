import { t } from "../i18n";
import styles from "./ConnectivityStatus.module.css";

function ConnectivityStatus({ online }) {
  if (online) return null;

  return (
    <aside className={styles.banner} role="status" aria-live="polite">
      <strong>{t("Offline")}</strong>
      <span>
        {t(
          "Your saved places and Show to driver still work. Live departures and route directions need an internet connection."
        )}
      </span>
    </aside>
  );
}

export default ConnectivityStatus;
