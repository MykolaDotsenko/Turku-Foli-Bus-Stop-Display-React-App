import { useEffect, useState } from "react";
import styles from "./BusStopForm.module.css";

function BusStopForm({ activeStopId, stops, loadingStops, onSubmit }) {
  const [value, setValue] = useState(activeStopId);
  const [validationError, setValidationError] = useState("");

  useEffect(() => setValue(activeStopId), [activeStopId]);

  const handleSubmit = (event) => {
    event.preventDefault();
    const normalized = value.trim();

    if (!/^\d+$/.test(normalized)) {
      setValidationError("Enter a numeric Föli stop ID.");
      return;
    }

    setValidationError("");
    onSubmit(normalized);
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form} noValidate>
      <div className={styles.field}>
        <label htmlFor="stop-number" className={styles.label}>
          Stop number
        </label>
        <div className={styles.controlRow}>
          <input
            id="stop-number"
            className={styles.input}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            inputMode="numeric"
            autoComplete="off"
            list="foli-stops"
            aria-describedby="stop-help stop-error"
            placeholder="e.g. 164"
          />
          <button className={styles.button} type="submit">
            Show departures
          </button>
        </div>

        <datalist id="foli-stops">
          {stops.map((stop) => (
            <option key={stop.id} value={stop.id}>
              {stop.name}
            </option>
          ))}
        </datalist>

        <div className={styles.metaRow}>
          <p id="stop-help" className={styles.help}>
            {loadingStops
              ? "Loading stop suggestions…"
              : "Enter the stop ID shown on the Föli stop sign."}
          </p>
          {validationError && (
            <p id="stop-error" className={styles.error} role="alert">
              {validationError}
            </p>
          )}
        </div>
      </div>
    </form>
  );
}

export default BusStopForm;
