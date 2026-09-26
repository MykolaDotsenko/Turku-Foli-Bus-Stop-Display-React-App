import { useEffect, useRef } from "react";
import { t, useLanguage } from "../i18n";
import styles from "./SafePlaceDriverCard.module.css";

// What the driver reads and hears is the same whichever language the app is
// in: Finnish, with English beside it for a driver or passenger who reads
// English better. Only the passenger's kicker and buttons follow the app.
const FINNISH_LEAD = "Olen menossa pysäkille";
const FINNISH_STOP = "Pysäkki";
const FINNISH_HELP =
  "Voitteko auttaa minua jäämään pois oikealla pysäkillä?";
const ENGLISH_STOP = "Stop";
const ENGLISH_HELP = "Please help me get off at this stop.";

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
  useLanguage();
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
        return;
      }

      // The card covers the screen, so Tab must not wander off into the
      // page hidden behind it.
      if (event.key === "Tab") {
        const buttons = [...(cardRef.current?.querySelectorAll("button") || [])];
        if (buttons.length === 0) return;

        const first = buttons[0];
        const last = buttons.at(-1);
        const active = globalThis.document?.activeElement;
        const inside = cardRef.current?.contains(active);

        if (event.shiftKey && (active === first || !inside)) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && (active === last || !inside)) {
          event.preventDefault();
          first.focus();
        }
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

  // Held up to a driver through the cab window, so it fills the screen and
  // leads in Finnish, with the stop as its largest words. It never names
  // the place: "I need to get to Home" told the driver nothing and told
  // everyone nearby where the passenger lives.
  return (
    <section
      ref={cardRef}
      className={styles.card}
      role="dialog"
      tabIndex={-1}
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div className={styles.content}>
        <p className={styles.kicker}>{t("Show this screen to the driver")}</p>
        <p className={styles.lead} lang="fi">
          {FINNISH_LEAD}
        </p>
        <h3 id={titleId} className={styles.stop}>
          {primaryStop.name}
          <span>
            <span lang="fi">{FINNISH_STOP}</span> /{" "}
            <span lang="en">
              {ENGLISH_STOP} {primaryStop.id}
            </span>
          </span>
        </h3>
        <p className={styles.finnish} lang="fi">
          {FINNISH_HELP}
        </p>
        <p className={styles.english} lang="en">
          {ENGLISH_HELP}
        </p>
      </div>
      <div className={styles.actions}>
        {canReadAloud && (
          <button
            type="button"
            className={styles.speakButton}
            onClick={readAloud}
          >
            <span aria-hidden="true">{"🔊"}</span>
            {t("Read aloud in Finnish")}
          </button>
        )}
        <button type="button" className={styles.closeButton} onClick={onClose}>
          {t("Close")}
        </button>
      </div>
    </section>
  );
}

export default SafePlaceDriverCard;
