// App.js
import React, { useState, useEffect } from "react";
import axios from "axios";
import BusStopForm from "./components/BusStopForm";
import BusStopDisplay from "./components/BusStopDisplay";
import './App.css'

const API_URL = "http://data.foli.fi/siri/sm/";

const App = () => {
  const [stopNumber, setStopNumber] = useState("164"); // Default stop number
  const [stopName, setStopName] = useState("");
  const [arrivals, setArrivals] = useState([]);
  const [error, setError] = useState(null);
  const [currentTime, setCurrentTime] = useState(
    new Date().toLocaleTimeString()
  );
  const [stops, setStops] = useState([]);

  const fetchArrivals = async (stopNumber) => {
    try {
      const response = await axios.get(`${API_URL}${stopNumber}`);
      setStopName(response.data.stopname);
      setArrivals(response.data.result);
      setError(null);
    } catch (error) {
      setStopName("");
      setArrivals([]);
      setError("Error fetching arrival data");
    }
  };

  useEffect(() => {
    fetchArrivals(stopNumber);

    // Auto-update every 30 seconds
    const interval = setInterval(() => {
      fetchArrivals(stopNumber);
    }, 30000);

    return () => clearInterval(interval);
  }, [stopNumber]);

  useEffect(() => {
    // Update current time every second
    const interval = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchStops = async () => {
      try {
        const response = await axios.get("http://data.foli.fi/siri/sm");
        setStops(response.data);
      } catch (error) {
        console.error("Error fetching stops:", error);
      }
    };

    fetchStops();
  }, []);

  const handleSubmit = (newStopNumber) => {
    setStopNumber(newStopNumber);
  };

  return (
    <div>
      <h1>Bus Stop Display</h1>
      <BusStopForm onSubmit={handleSubmit} stops={stops} />
      {error && <p>{error}</p>}
      <BusStopDisplay
        stopName={stopName}
        arrivals={arrivals}
        currentTime={currentTime}
      />
    </div>
  );
};

export default App;
