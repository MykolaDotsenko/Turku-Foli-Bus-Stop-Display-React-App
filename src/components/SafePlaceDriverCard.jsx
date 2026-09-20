import { useEffect, useRef } from "react";
import styles from "./SafePlaceDriverCard.module.css";

const FINNISH_HELP =
  "Voitteko auttaa minua jäämään pois oikealla pysäkillä?";

function speechSupported() {
  return (
    typeof globalThis.SpeechSynthesisUtterance === "function" &&
    typeof globalThis.speechSynthesis?.speak === "function"
  );
}

function SafePlaceDriverCard({
  place,
  primaryStop,
  onClose,
  idPrefix = "safe-place",
}) {
  const usedSpeech = useRef(false);
  const cardRef = useRef(null);
  const previousFocusRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    previousFocusRef.current = globalThis.document?.activeElement || null;
    cardRef.current?.focus();

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current?.();
      }
    };

    globalThis.document?.addEventListener("keydown", handleKeyDown);

    return () => {
      globalThis.document?.removeEventListener("keydown", handleKeyDown);

      if (usedSpeech.current) {
        globalThis.speechSynthesis?.cancel?.();
      }

      const previousFocus = previousFocusRef.current;
      if (previousFocus?.isConnected && typeof previousFocus.focus === "function") {
        previousFocus.focus();
      }
    };
  }, []);

  if (!place || !primaryStop) return null;

  const titleId = `${idPrefix}-driver-${place.id}-title`;
  const canReadAloud = speechSupported();

  const readAloud = () => {
    if (!canReadAloud) return;

    const utterance = new globalThis.SpeechSynthesisUtterance(
      `Tarvitsen apua. Olen menossa pysäkille ${primaryStop.name}, pysäkki ${primaryStop.id}. ${FINNISH_HELP}`
    );
    utterance.lang = "fi-FI";
    utterance.rate = 0.9;

    usedSpeech.current = true;
    globalThis.speechSynthesis.cancel();
    globalThis.speechSynthesis.speak(utterance);
  };

  return (
    <section
      ref={cardRef}
      className={styles.card}
      role="dialog"
      tabIndex={-1}
      aria-modal="false"
      aria-labelledby={titleId}
    >
      <p className={styles.kicker}>Show this screen to the driver</p>
      <h3 id={titleId}>I need to get to {place.label}</h3>
      <p className={styles.stop}>
        {primaryStop.name}
        <span>Stop {primaryStop.id}</span>
      </p>
      <p className={styles.finnish}>{FINNISH_HELP}</p>
      <div className={styles.actions}>
        {canReadAloud && (
          <button
            type="button"
            className={styles.speakButton}
            onClick={readAloud}
          >
            <span aria-hidden="true">🔊</span>
            Read aloud in Finnish
          </button>
        )}
        <button type="button" className={styles.closeButton} onClick={onClose}>
          Close
        </button>
      </div>
    </section>
  );
}

export default SafePlaceDriverCard;
