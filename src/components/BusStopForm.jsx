import { useEffect, useState } from "react";
import styles from "./BusStopForm.module.css";

function BusStopForm({ activeStopId, stops, onSubmit }) {
  const [value, setValue] = useState(activeStopId);
  const [validationError, setValidationError] = useState("");

  useEffect(() => setValue(activeStopId), [activeStopId]);

  const handleSubmit = (event) => {
    event.preventDefault();
    const stopId = value.trim();

    if (!/^\d+$/.test(stopId)) {
      setValidationError("Enter a numeric stop number.");
      return;
    }

    setValidationError("");
    onSubmit(stopId);
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form} noValidate>
      <label htmlFor="stop-number" className={styles.label}>
        Stop number
      </label>

      <div className={styles.controls}>
        <input
          id="stop-number"
          className={styles.input}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          inputMode="numeric"
          autoComplete="off"
          list="foli-stops"
          aria-invalid={Boolean(validationError)}
          aria-describedby={validationError ? "stop-error" : undefined}
          placeholder="164"
        />
        <button className={styles.button} type="submit">
          Show
        </button>
      </div>

      <datalist id="foli-stops">
        {stops.map((stop) => (
          <option key={stop.id} value={stop.id}>
            {stop.name}
          </option>
        ))}
      </datalist>

      {validationError && (
        <p id="stop-error" className={styles.error} role="alert">
          {validationError}
        </p>
      )}
    </form>
  );
}

export default BusStopForm;
