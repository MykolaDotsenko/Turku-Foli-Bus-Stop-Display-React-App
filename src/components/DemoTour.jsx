import { useEffect, useId, useRef, useState } from "react";
import styles from "./DemoTour.module.css";

const DEMO_STEPS = [
  {
    eyebrow: "Turku · Åbo",
    title: "Know what leaves next",
    body:
      "Search a Föli stop by name or number, or use your location to find the nearest stop.",
    scene: "search",
  },
  {
    eyebrow: "Live departures",
    title: "See what is live — and what is scheduled",
    body:
      "The board keeps realtime and timetable data distinct, so a scheduled departure is never presented as live.",
    scene: "departures",
  },
  {
    eyebrow: "Ride Mode",
    title: "Get told before your stop",
    body:
      "Start Ride Mode for a trip and the app follows your progress, warns you before the stop, and tells you when to get off.",
    scene: "ride",
  },
  {
    eyebrow: "Safe Places",
    title: "Keep Home and useful places close",
    body:
      "Save places you rely on. If a trip goes wrong, recovery actions help you get back to a known stop or destination.",
    scene: "places",
  },
  {
    eyebrow: "Try the real thing",
    title: "Open Kauppatori with live Föli data",
    body:
      "The demo never replaces the actual product. Finish here and jump straight into a real central Turku stop.",
    scene: "ready",
  },
];

function SearchPreview() {
  return (
    <div className={styles.previewCard}>
      <span className={styles.previewLabel}>Find your stop</span>
      <div className={styles.fakeSearchRow}>
        <span className={styles.fakeInput}>Kauppatori</span>
        <span className={styles.fakeLocation} aria-hidden="true">
          ⌖
        </span>
        <span className={styles.fakeButton}>Show</span>
      </div>
      <span className={styles.previewHint}>Stop 164 · central Turku</span>
    </div>
  );
}

function DeparturesPreview() {
  return (
    <div className={styles.previewCard}>
      <div className={styles.previewHeader}>
        <strong>Kauppatori</strong>
        <span>Stop 164</span>
      </div>
      <div className={styles.departureRow}>
        <span className={styles.routeBadge}>1</span>
        <span className={styles.destination}>Satama</span>
        <span className={styles.liveTag}>Live · 3 min</span>
      </div>
      <div className={styles.departureRow}>
        <span className={styles.routeBadge}>7</span>
        <span className={styles.destination}>Kaarina</span>
        <span className={styles.scheduledTag}>Scheduled · 8 min</span>
      </div>
    </div>
  );
}

function RidePreview() {
  return (
    <div className={styles.previewCard}>
      <div className={styles.rideTopline}>
        <span className={styles.routeBadge}>1</span>
        <strong>Ride Mode active</strong>
      </div>
      <div className={styles.progressTrack} aria-hidden="true">
        <span className={styles.progressFill} />
      </div>
      <div className={styles.previewHeader}>
        <span>2 stops to go</span>
        <strong>Alert armed</strong>
      </div>
    </div>
  );
}

function PlacesPreview() {
  return (
    <div className={styles.previewCard}>
      <div className={styles.placeRow}>
        <span className={styles.placeIcon} aria-hidden="true">
          ⌂
        </span>
        <span>
          <strong>Home</strong>
          <small>Saved safe place</small>
        </span>
      </div>
      <div className={styles.placeRow}>
        <span className={styles.placeIcon} aria-hidden="true">
          ↗
        </span>
        <span>
          <strong>Get me Home</strong>
          <small>Recovery when the journey changes</small>
        </span>
      </div>
    </div>
  );
}

function ReadyPreview() {
  return (
    <div className={styles.previewCard}>
      <div className={styles.readyMark} aria-hidden="true">
        ✓
      </div>
      <strong className={styles.readyTitle}>Ready for a real stop</strong>
      <span className={styles.previewHint}>
        Kauppatori · live data when available
      </span>
    </div>
  );
}

function StepPreview({ scene }) {
  if (scene === "search") return <SearchPreview />;
  if (scene === "departures") return <DeparturesPreview />;
  if (scene === "ride") return <RidePreview />;
  if (scene === "places") return <PlacesPreview />;
  return <ReadyPreview />;
}

function DemoTour({ open, onClose, onOpenKauppatori }) {
  const [stepIndex, setStepIndex] = useState(0);
  const closeButtonRef = useRef(null);
  const previousFocusRef = useRef(null);
  const titleId = useId();
  const descriptionId = useId();
  const step = DEMO_STEPS[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === DEMO_STEPS.length - 1;

  useEffect(() => {
    if (!open) return undefined;

    previousFocusRef.current = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      previousFocusRef.current?.focus?.();
    };
  }, [open]);

  useEffect(() => {
    if (open) setStepIndex(0);
  }, [open]);

  if (!open) return null;

  const moveTo = (nextIndex) => {
    setStepIndex(Math.max(0, Math.min(DEMO_STEPS.length - 1, nextIndex)));
  };

  const handleKeyDown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }

    if (event.key === "ArrowRight" && !isLast) {
      event.preventDefault();
      moveTo(stepIndex + 1);
      return;
    }

    if (event.key === "ArrowLeft" && !isFirst) {
      event.preventDefault();
      moveTo(stepIndex - 1);
      return;
    }

    if (event.key !== "Tab") return;

    const focusable = [...event.currentTarget.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )].filter((node) => node.getAttribute("aria-hidden") !== "true");

    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const openRealStop = () => {
    onClose();
    onOpenKauppatori();
  };

  return (
    <div
      className={styles.backdrop}
      role="presentation"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onKeyDown={handleKeyDown}
        data-scene={step.scene}
      >
        <img
          className={styles.skyline}
          src={`${import.meta.env.BASE_URL}turku-skyline.svg`}
          alt=""
          aria-hidden="true"
        />

        <button
          ref={closeButtonRef}
          type="button"
          className={styles.closeButton}
          onClick={onClose}
          aria-label="Close Turku demo"
        >
          ×
        </button>

        <div className={styles.copy}>
          <div className={styles.stepMeta}>
            <span>{step.eyebrow}</span>
            <span aria-live="polite">
              {stepIndex + 1} / {DEMO_STEPS.length}
            </span>
          </div>

          <h2 id={titleId}>{step.title}</h2>
          <p id={descriptionId}>{step.body}</p>
        </div>

        <div className={styles.preview}>
          <StepPreview scene={step.scene} />
        </div>

        <div className={styles.progress} aria-hidden="true">
          {DEMO_STEPS.map((item, index) => (
            <span
              key={item.scene}
              className={index === stepIndex ? styles.progressActive : ""}
            />
          ))}
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => moveTo(stepIndex - 1)}
            disabled={isFirst}
          >
            Back
          </button>

          {isLast ? (
            <button
              type="button"
              className={styles.primaryButton}
              onClick={openRealStop}
            >
              Open Kauppatori
            </button>
          ) : (
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => moveTo(stepIndex + 1)}
            >
              Next
            </button>
          )}
        </div>

        <button type="button" className={styles.skipButton} onClick={onClose}>
          Skip demo
        </button>
      </section>
    </div>
  );
}

export default DemoTour;
