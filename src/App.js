import { useState } from "react";
import "./App.css";
import BusStopDisplay from "./components/BusStopDisplay";
import BusStopForm from "./components/BusStopForm";
import useStopCatalog from "./hooks/useStopCatalog";
import useStopMonitor from "./hooks/useStopMonitor";

const DEFAULT_STOP = "164";

function App() {
  const [stopId, setStopId] = useState(DEFAULT_STOP);
  const { stops, loadingStops } = useStopCatalog();
  const {
    stopName,
    arrivals,
    serverTime,
    loading,
    refreshing,
    error,
    refresh,
  } = useStopMonitor(stopId);

  return (
    <main className="app-shell">
      <section className="hero" aria-labelledby="page-title">
        <div>
          <p className="eyebrow">Turku region public transport</p>
          <h1 id="page-title">Föli live departures</h1>
          <p className="hero-copy">
            A focused real-time departure board for any Föli stop.
          </p>
        </div>
        <div className="live-badge" aria-label="Updates automatically every 30 seconds">
          <span className="live-dot" aria-hidden="true" />
          Live
        </div>
      </section>

      <section className="search-card" aria-label="Choose a bus stop">
        <BusStopForm
          activeStopId={stopId}
          stops={stops}
          loadingStops={loadingStops}
          onSubmit={setStopId}
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
        Source: Turku region public transport real-time data via data.foli.fi
        (CC BY 4.0).
      </footer>
    </main>
  );
}

export default App;
