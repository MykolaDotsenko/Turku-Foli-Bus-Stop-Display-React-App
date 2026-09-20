import styles from "./SafePlaceDriverCard.module.css";

function SafePlaceDriverCard({
  place,
  primaryStop,
  onClose,
  idPrefix = "safe-place",
}) {
  if (!place || !primaryStop) return null;

  const titleId = `${idPrefix}-driver-${place.id}-title`;

  return (
    <section
      className={styles.card}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
    >
      <p className={styles.kicker}>Show this screen to the driver</p>
      <h3 id={titleId}>I need to get to {place.label}</h3>
      <p className={styles.stop}>
        {primaryStop.name}
        <span>Stop {primaryStop.id}</span>
      </p>
      <p className={styles.finnish}>
        Voitteko auttaa minua jäämään pois oikealla pysäkillä?
      </p>
      <button type="button" className={styles.closeButton} onClick={onClose}>
        Close
      </button>
    </section>
  );
}

export default SafePlaceDriverCard;
