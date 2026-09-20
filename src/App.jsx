import { useEffect, useState } from "react";
import "./App.css";
import BusStopDisplay from "./components/BusStopDisplay";
import BusStopForm from "./components/BusStopForm";
import QuickStops from "./components/QuickStops";
import useSavedStops from "./hooks/useSavedStops";
import useStopCatalog from "./hooks/useStopCatalog";
import useStopMonitor from "./hooks/useStopMonitor";

const DEFAULT_STOP = "164";

function stopFromLocation() {
  const stopFromUrl = new URLSearchParams(window.location.search).get("stop");
  return /^\d+$/.test(stopFromUrl || "") ? stopFromUrl : DEFAULT_STOP;
}

function App() {
  const [stopId, setStopId] = useState(stopFromLocation);
  const stops = useStopCatalog();
  const {
    favorites,
    recents,
    favoriteIds,
    rememberRecent,
    toggleFavorite,
  } = useSavedStops();
  const {
    stopName,
    arrivals,
    serverTime,
    loading,
    refreshing,
    error,
    refresh,
  } = useStopMonitor(stopId);

  useEffect(() => {
    const handlePopState = () => setStopId(stopFromLocation());
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (stopName) {
      rememberRecent({ id: stopId, name: stopName });
    }
  }, [rememberRecent, stopId, stopName]);

  const selectStop = (nextStopId) => {
    if (!/^\d+$/.test(nextStopId || "")) return;

    if (nextStopId === stopId) {
      refresh();
      return;
    }

    setStopId(nextStopId);
    window.history.pushState(null, "", \`?stop=\${nextStopId}\`);
  };

  const currentStop = {
    id: stopId,
    name: stopName || \`Stop \${stopId}\`,
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Turku region · live public transport</p>
          <p className="brand">Föli departures</p>
          <p className="context">
            Find a stop once, save it, and get back to live departures in one
            tap.
          </p>
        </div>
        <span className="live-pill">
          <span className="live-dot" aria-hidden="true" />
          Föli SIRI
        </span>
      </header>

      <section className="search-panel" aria-label="Choose a bus stop">
        <BusStopForm
          activeStopId={stopId}
          stops={stops}
          onSubmit={selectStop}
        />
      </section>

      <QuickStops
        favorites={favorites}
        recents={recents}
        activeStopId={stopId}
        onSelect={selectStop}
      />

      <BusStopDisplay
        stopId={stopId}
        stopName={stopName}
        arrivals={arrivals}
        serverTime={serverTime}
        loading={loading}
        refreshing={refreshing}
        error={error}
        onRefresh={() => refresh()}
        isFavorite={favoriteIds.has(stopId)}
        onToggleFavorite={() => toggleFavorite(currentStop)}
      />

      <footer className="source-note">
        Source: Turku region public transport · data.foli.fi · CC BY 4.0
      </footer>
    </main>
  );
}

export default App;
