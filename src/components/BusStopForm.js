import React, { useState } from 'react';
import styles from './BusStopForm.module.css';

const BusStopForm = ({ onSubmit }) => {
  const [stopNumber, setStopNumber] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(stopNumber);
  };

  const handleInputChange = (e) => {
    setStopNumber(e.target.value);
  };

  return (
    <div className={styles.formContainer}>
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.formGroup}>
          <label htmlFor="stopNumber" className={styles.label}>Enter Stop Number:</label>
          <input
            type="text"
            id="stopNumber"
            className={styles.input}
            value={stopNumber}
            onChange={handleInputChange}
            placeholder="Enter stop number"
          />
        </div>
        <button type="submit" className={styles.button}>Get Arrival Info</button>
      </form>
    </div>
  );
};

export default BusStopForm;
