import { useState } from "react";
import "./App.css";
import BusStopDisplay from "./components/BusStopDisplay";
import BusStopForm from "./components/BusStopForm";
import useStopCatalog from "./hooks/useStopCatalog";
import useStopMonitor from "./hooks/useStopMonitor";

const DEFAULT_STOP = "164";

function getInitialStop() {
  const stopFromUrl = new URLSearchParams(window.location.search).get("stop");
  return /^\d+$/.test(stopFromUrl || "") ? stopFromUrl : DEFAULT_STOP;
}

function App() {
  const [stopId, setStopId] = useState(getInitialStop);
  const stops = useStopCatalog();
  const {
    stopName,
    arrivals,
    serverTime,
    loading,
    refreshing,
    error,
    refresh,
  } = useStopMonitor(stopId);

  const selectStop = (nextStopId) => {
    setStopId(nextStopId);
    window.history.replaceState(null, "", `?stop=${nextStopId}`);
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <p className="brand">Föli departures</p>
        <p className="context">Turku region · auto-refresh every 30 seconds</p>
      </header>

      <section className="search-panel" aria-label="Choose a bus stop">
        <BusStopForm
          activeStopId={stopId}
          stops={stops}
          onSubmit={selectStop}
        />
      </section>

      <BusStopDisplay
        stopId={stopId}
        stopName={stopName}
        arrivals={arrivals}
        serverTime={serverTime}
        loading={loading}
        refreshing={refreshing}
        error={error}
        onRefresh={() => refresh()}
      />

      <footer className="source-note">
        Data: Föli / Turku region public transport · CC BY 4.0
      </footer>
    </main>
  );
}

export default App;
