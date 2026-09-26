import { t } from "../i18n";
import styles from "./QuickStops.module.css";
import { stopLabel } from "../utils/stopNames";

function StopChip({ stop, onSelect, favorite = false }) {
  return (
    <button
      type="button"
      className={styles.chip}
      onClick={() => onSelect(stop.id)}
      title={t("Open {name}, stop {id}", { name: stopLabel(stop), id: stop.id })}
    >
      <span className={styles.chipIcon} aria-hidden="true">
        {favorite ? "★" : "↺"}
      </span>
      <span className={styles.chipLabel}>
        <strong>{stopLabel(stop)}</strong>
        <span>{t("Stop {id}", { id: stop.id })}</span>
      </span>
    </button>
  );
}

function QuickStops({ favorites, recents, activeStopId, onSelect }) {
  const visibleRecents = recents.filter(
    (recent) =>
      recent.id !== activeStopId &&
      !favorites.some((favorite) => favorite.id === recent.id)
  );

  if (favorites.length === 0 && visibleRecents.length === 0) return null;

  return (
    <nav className={styles.wrapper} aria-label={t("Saved and recent stops")}>
      {favorites.length > 0 && (
        <section className={styles.group} aria-labelledby="favorite-stops">
          <h2 id="favorite-stops" className={styles.heading}>
            {t("Favourites")}
          </h2>
          <div className={styles.scroller}>
            {favorites.map((stop) => (
              <StopChip
                key={stop.id}
                stop={stop}
                favorite
                onSelect={onSelect}
              />
            ))}
          </div>
        </section>
      )}

      {visibleRecents.length > 0 && (
        <section className={styles.group} aria-labelledby="recent-stops">
          <h2 id="recent-stops" className={styles.heading}>
            {t("Recent")}
          </h2>
          <div className={styles.scroller}>
            {visibleRecents.map((stop) => (
              <StopChip key={stop.id} stop={stop} onSelect={onSelect} />
            ))}
          </div>
        </section>
      )}
    </nav>
  );
}

export default QuickStops;
