import { useState } from "react";
import "./App.css";
import BusStopDisplay from "./components/BusStopDisplay";
import BusStopForm from "./components/BusStopForm";
import useStopCatalog from "./hooks/useStopCatalog";
import useStopMonitor from "./hooks/useStopMonitor";

const DEFAULT_STOP = "164";

function App() {
  const [stopId, setStopId] = useState(DEFAULT_STOP);
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

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="brand">Föli departures</p>
          <p className="context">Turku region · auto-refresh every 30 seconds</p>
        </div>
      </header>

      <section className="search-panel" aria-label="Choose a bus stop">
        <BusStopForm
          activeStopId={stopId}
          stops={stops}
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
        onRefresh={refresh}
      />

      <footer className="source-note">
        Data: Föli / Turku region public transport · CC BY 4.0
      </footer>
    </main>
  );
}

export default App;
