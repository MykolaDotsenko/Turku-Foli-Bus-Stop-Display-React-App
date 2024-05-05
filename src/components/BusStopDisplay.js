import React from 'react';
import styles from './BusStopDisplay.module.css';

const BusStopDisplay = ({ stopName, arrivals, currentTime }) => {
  return (
    <div className={styles.displayContainer}>
      <h2 className={styles.stopName}>{stopName}</h2>
      <p className={styles.currentTime}>Current Time: {currentTime}</p>
      <ul className={styles.arrivalList}>
        {arrivals.map((arrival, index) => (
          <li key={index} className={styles.arrivalItem}>
            <strong>Destination:</strong> {arrival.destinationdisplay}<br />
            <strong>Scheduled Arrival:</strong> {new Date(arrival.expectedarrivaltime * 1000).toLocaleTimeString()}<br />
            <strong>Status:</strong> {arrival.delay < 0 ? 'Early by' : 'Late by'} {Math.abs(arrival.delay)} minutes
          </li>
        ))}
      </ul>
    </div>
  );
};

export default BusStopDisplay;
