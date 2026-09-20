import { useEffect, useMemo, useState } from "react";
import "./App.css";
import BusStopDisplay from "./components/BusStopDisplay";
import BusStopForm from "./components/BusStopForm";
import ConnectivityStatus from "./components/ConnectivityStatus";
import HomeRecovery from "./components/HomeRecovery";
import MyPlaces from "./components/MyPlaces";
import NearbyStops from "./components/NearbyStops";
import QuickStops from "./components/QuickStops";
import ServiceAlerts from "./components/ServiceAlerts";
import useOnlineStatus from "./hooks/useOnlineStatus";
import useRouteCatalog from "./hooks/useRouteCatalog";
import useSavedPlaces from "./hooks/useSavedPlaces";
import useSavedStops from "./hooks/useSavedStops";
import useStopAlerts from "./hooks/useStopAlerts";
import useStopCatalog from "./hooks/useStopCatalog";
import useStopMonitor from "./hooks/useStopMonitor";
import { buildRouteIndexes } from "./utils/routes";
import { clearSharedPlaceHash, parseSharedPlaceHash } from "./utils/sharedPlaces";

const DEFAULT_STOP = "164";

function stopFromLocation() {
  const stopFromUrl = new URLSearchParams(window.location.search).get("stop");
  return /^\d+$/.test(stopFromUrl || "") ? stopFromUrl : DEFAULT_STOP;
}

function App() {
  const [stopId, setStopId] = useState(stopFromLocation);
  const [sharedPlace, setSharedPlace] = useState(() =>
    parseSharedPlaceHash(window.location.hash)
  );
  const online = useOnlineStatus();
  const { stops, coordinatesStatus } = useStopCatalog();
  const routes = useRouteCatalog();
  const { byId: routesById, byShortName: routesByShortName } = useMemo(
    () => buildRouteIndexes(routes),
    [routes]
  );
  const {
    favorites,
    recents,
    favoriteIds,
    rememberRecent,
    toggleFavorite,
  } = useSavedStops();
  const {
    byId: placesById,
    savePlace,
    removePlace,
    setPrimaryStop,
  } = useSavedPlaces();
  const {
    stopName,
    arrivals,
    serverTime,
    loading,
    refreshing,
    error,
    refresh,
  } = useStopMonitor(stopId);
  const activeLines = useMemo(
    () => [...new Set(arrivals.map((arrival) => arrival.lineref).filter(Boolean))],
    [arrivals]
  );
  const serviceAlerts = useStopAlerts(stopId, activeLines, routesById);
  const selectedStop = useMemo(
    () => stops.find((stop) => stop.id === stopId) || null,
    [stopId, stops]
  );

  useEffect(() => {
    const handlePopState = () => setStopId(stopFromLocation());
    const handleHashChange = () =>
      setSharedPlace(parseSharedPlaceHash(window.location.hash));

    window.addEventListener("popstate", handlePopState);
    window.addEventListener("hashchange", handleHashChange);

    return () => {
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("hashchange", handleHashChange);
    };
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
    window.history.pushState(null, "", `?stop=${nextStopId}`);
  };

  const currentStop = {
    id: stopId,
    name: stopName || `Stop ${stopId}`,
  };

  const dismissSharedPlace = () => {
    setSharedPlace(null);
    clearSharedPlaceHash();
  };

  const importSharedPlace = () => {
    if (!sharedPlace) return;
    savePlace(sharedPlace);
    dismissSharedPlace();
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Turku region · live public transport</p>
          <p className="brand">Föli departures</p>
          <p className="context">
            Find a stop, save Home, School or Work without remembering an
            address, and get back to the right journey in one tap.
          </p>
        </div>
        <span className="live-pill">
          <span className="live-dot" aria-hidden="true" />
          Föli SIRI
        </span>
      </header>

      <ConnectivityStatus online={online} />

      <HomeRecovery
        home={placesById.get("home") || null}
        stops={stops}
        online={online}
        onOpenStop={selectStop}
      />

      <section className="search-panel" aria-label="Choose a bus stop">
        <BusStopForm
          activeStopId={stopId}
          stops={stops}
          onSubmit={selectStop}
        />
      </section>

      <NearbyStops
        stops={stops}
        coordinatesStatus={coordinatesStatus}
        activeStopId={stopId}
        online={online}
        onSelect={selectStop}
      />

      <QuickStops
        favorites={favorites}
        recents={recents}
        activeStopId={stopId}
        onSelect={selectStop}
      />

      <ServiceAlerts alerts={serviceAlerts} />

      <BusStopDisplay
        stopId={stopId}
        stopName={stopName}
        stop={selectedStop}
        arrivals={arrivals}
        routesByShortName={routesByShortName}
        serverTime={serverTime}
        loading={loading}
        refreshing={refreshing}
        error={error}
        onRefresh={() => refresh()}
        isFavorite={favoriteIds.has(stopId)}
        onToggleFavorite={() => toggleFavorite(currentStop)}
      />

      <MyPlaces
        stops={stops}
        coordinatesStatus={coordinatesStatus}
        activeStopId={stopId}
        placesById={placesById}
        sharedPlace={sharedPlace}
        online={online}
        onSavePlace={savePlace}
        onImportSharedPlace={importSharedPlace}
        onDismissSharedPlace={dismissSharedPlace}
        onRemovePlace={removePlace}
        onSetPrimaryStop={setPrimaryStop}
        onOpenStop={selectStop}
      />

      <footer className="source-note">
        Source: Turku region public transport · data.foli.fi · CC BY 4.0
      </footer>
    </main>
  );
}

export default App;
