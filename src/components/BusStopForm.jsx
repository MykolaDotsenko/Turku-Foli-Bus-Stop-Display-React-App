import { useEffect, useMemo, useState } from "react";
import styles from "./BusStopForm.module.css";

const MAX_SUGGESTIONS = 6;

function normalize(value) {
  return String(value || "")
    .trim()
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function scoreStop(stop, query) {
  const id = normalize(stop.id);
  const name = normalize(stop.name);

  if (id === query || name === query) return 0;
  if (id.startsWith(query)) return 1;
  if (name.startsWith(query)) return 2;
  if (name.includes(query)) return 3;
  if (id.includes(query)) return 4;
  return Infinity;
}

function findMatches(stops, query) {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return [];

  return stops
    .map((stop) => ({ stop, score: scoreStop(stop, normalizedQuery) }))
    .filter(({ score }) => Number.isFinite(score))
    .sort(
      (a, b) =>
        a.score - b.score ||
        a.stop.name.localeCompare(b.stop.name, undefined, {
          sensitivity: "base",
        })
    )
    .slice(0, MAX_SUGGESTIONS)
    .map(({ stop }) => stop);
}

function BusStopForm({ activeStopId, stops, onSubmit }) {
  const [value, setValue] = useState(activeStopId);
  const [validationError, setValidationError] = useState("");
  const [focused, setFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => setValue(activeStopId), [activeStopId]);

  const matches = useMemo(() => findMatches(stops, value), [stops, value]);
  const showSuggestions = focused && value.trim() && matches.length > 0;

  const chooseStop = (stop) => {
    setValue(stop.id);
    setValidationError("");
    setActiveIndex(-1);
    onSubmit(stop.id);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const query = value.trim();

    if (/^\d+$/.test(query)) {
      setValidationError("");
      onSubmit(query);
      return;
    }

    const exactNames = stops.filter(
      (stop) => normalize(stop.name) === normalize(query)
    );

    if (exactNames.length === 1) {
      chooseStop(exactNames[0]);
      return;
    }

    if (exactNames.length > 1) {
      setFocused(true);
      setActiveIndex(-1);
      setValidationError(
        "More than one stop has this name. Choose the correct stop number from the suggestions."
      );
      return;
    }

    if (matches.length === 1) {
      chooseStop(matches[0]);
      return;
    }

    setValidationError(
      "Choose a stop from the suggestions or enter its stop number."
    );
  };

  const handleKeyDown = (event) => {
    if (!showSuggestions) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % matches.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) =>
        index <= 0 ? matches.length - 1 : index - 1
      );
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      chooseStop(matches[activeIndex]);
    } else if (event.key === "Escape") {
      setActiveIndex(-1);
      setFocused(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form} noValidate>
      <label htmlFor="stop-search" className={styles.label}>
        Find your stop
      </label>

      <div className={styles.searchWrap}>
        <div className={styles.controls}>
          <input
            id="stop-search"
            className={styles.input}
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              setValidationError("");
              setActiveIndex(-1);
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={Boolean(showSuggestions)}
            aria-controls="foli-stop-suggestions"
            aria-activedescendant={
              activeIndex >= 0 ? `foli-stop-option-${activeIndex}` : undefined
            }
            aria-invalid={Boolean(validationError)}
            aria-describedby={
              validationError ? "stop-error" : "stop-search-help"
            }
            placeholder="Kauppatori or 164"
          />
          <button className={styles.button} type="submit">
            Show departures
          </button>
        </div>

        {showSuggestions && (
          <div
            id="foli-stop-suggestions"
            className={styles.suggestions}
            role="listbox"
            aria-label="Matching bus stops"
          >
            {matches.map((stop, index) => (
              <div
                key={stop.id}
                id={`foli-stop-option-${index}`}
                className={styles.suggestion}
                role="option"
                aria-selected={index === activeIndex}
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => chooseStop(stop)}
              >
                <span className={styles.suggestionName}>{stop.name}</span>
                <span className={styles.suggestionId}>Stop {stop.id}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <p id="stop-search-help" className={styles.help}>
        Search by stop name or number. Use ↑ and ↓ to move through suggestions.
      </p>

      {validationError && (
        <p id="stop-error" className={styles.error} role="alert">
          {validationError}
        </p>
      )}
    </form>
  );
}

export default BusStopForm;
