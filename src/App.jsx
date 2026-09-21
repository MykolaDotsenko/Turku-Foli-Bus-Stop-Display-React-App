import { useEffect, useMemo, useState } from "react";
import "./App.css";
import BusStopDisplay from "./components/BusStopDisplay";
import BusStopForm from "./components/BusStopForm";
import ConnectivityStatus from "./components/ConnectivityStatus";
import HomeRecovery from "./components/HomeRecovery";
import MyPlaces from "./components/MyPlaces";
import NearbyStops from "./components/NearbyStops";
import QuickStops from "./components/QuickStops";
import RideMode from "./components/RideMode";
import ServiceAlerts from "./components/ServiceAlerts";
import useOnlineStatus from "./hooks/useOnlineStatus";
import useRouteCatalog from "./hooks/useRouteCatalog";
import useRideMode from "./hooks/useRideMode";
import useSavedPlaces from "./hooks/useSavedPlaces";
import useSavedStops from "./hooks/useSavedStops";
import useServiceBoundary from "./hooks/useServiceBoundary";
import useStopAlerts from "./hooks/useStopAlerts";
import useStopCatalog from "./hooks/useStopCatalog";
import useStopMonitor from "./hooks/useStopMonitor";
import { buildRouteIndexes } from "./utils/routes";
import { clearSharedPlaceHash, parseSharedPlaceHash } from "./utils/sharedPlaces";


function stopFromLocation() {
  const stopFromUrl = new URLSearchParams(window.location.search).get("stop");
  return /^\d+$/.test(stopFromUrl || "") ? stopFromUrl : "";
}

function stopUrl(stopId) {
  const url = new globalThis.URL(window.location.href);

  if (/^\d+$/.test(stopId || "")) {
    url.searchParams.set("stop", stopId);
  } else {
    url.searchParams.delete("stop");
  }

  return `${url.pathname}${url.search}${url.hash}`;
}

function currentHistoryState() {
  return window.history.state && typeof window.history.state === "object"
    ? window.history.state
    : {};
}

function canonicalizeCurrentStop(stopId) {
  window.history.replaceState(currentHistoryState(), "", stopUrl(stopId));
}

function App() {
  const [stopId, setStopId] = useState(stopFromLocation);
  const [sharedPlace, setSharedPlace] = useState(() =>
    parseSharedPlaceHash(window.location.hash)
  );
  const online = useOnlineStatus();
  const ride = useRideMode();
  const { geometry: serviceBoundary } = useServiceBoundary();
  const {
    stops,
    coordinatesStatus,
    catalogStatus,
    catalogSavedAt,
  } = useStopCatalog();
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
    places,
    byId: placesById,
    savePlace,
    revalidatePlaces,
    removePlace,
    setPrimaryStop,
  } = useSavedPlaces();
  const {
    stopName,
    arrivals,
    serverTime,
    receivedAtMs,
    realtimeAvailable,
    scheduleAvailable,
    loading,
    refreshing,
    error,
    refresh,
  } = useStopMonitor(stopId);
  const activeLines = useMemo(
    () => [...new Set(arrivals.map((arrival) => arrival.lineref).filter(Boolean))],
    [arrivals]
  );
  const {
    alerts: serviceAlerts,
    error: serviceAlertsError,
    receivedAtMs: serviceAlertsReceivedAtMs,
  } = useStopAlerts(stopId, activeLines, routesById);
  const selectedStop = useMemo(
    () => stops.find((stop) => stop.id === stopId) || null,
    [stopId, stops]
  );
  const displayStopName = selectedStop?.name || stopName;

  useEffect(() => {
    const currentStopId = stopFromLocation();
    canonicalizeCurrentStop(currentStopId);

    const handlePopState = () => {
      // The shareable URL is the single source of truth for browser history.
      // Avoid duplicating stop identity in history.state, which can diverge
      // across same-document navigation implementations.
      setStopId(stopFromLocation());
    };
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
    if (catalogStatus === "ready" && catalogSavedAt > 0) {
      revalidatePlaces(stops, catalogSavedAt);
    }
  }, [
    catalogSavedAt,
    catalogStatus,
    places,
    revalidatePlaces,
    stops,
  ]);

  useEffect(() => {
    if (displayStopName) {
      rememberRecent({ id: stopId, name: displayStopName });
    }
  }, [displayStopName, rememberRecent, stopId]);

  const selectStop = (nextStopId) => {
    if (!/^\d+$/.test(nextStopId || "")) return;

    if (nextStopId === stopId) {
      refresh();
      return;
    }

    // Preserve unrelated browser/router state, but keep the stop identity only
    // in the shareable URL so Back/Forward has one canonical source of truth.
    canonicalizeCurrentStop(stopId);
    window.history.pushState(currentHistoryState(), "", stopUrl(nextStopId));
    setStopId(nextStopId);
  };

  const currentStop = stopId
    ? {
        id: stopId,
        name: displayStopName || `Stop ${stopId}`,
      }
    : null;

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
          {/* Turku is officially bilingual, and the pairing is itself a
              local signal. The independence disclaimer keeps its place in
              the footer; this line has one job, which is "you are here". */}
          <p className="eyebrow">Turku · Åbo</p>
          <p className="brand">Föli departures</p>
          <p
            className="context"
            data-firstrun={placesById.size === 0 ? "true" : "false"}
          >
            Find a stop, save the places you travel to, and get told when to
            get off.
          </p>
        </div>
        <span
          className="live-pill"
          data-online={online ? "true" : "false"}
          aria-live="polite"
        >
          <span className="live-dot" aria-hidden="true" />
          {online ? "Live Föli data" : "Offline mode"}
        </span>
      </header>

      <ConnectivityStatus online={online} />

      {ride.session && (
        <RideMode
          session={ride.session}
          runtime={ride.runtime}
          gps={ride.gps}
          wakeLockState={ride.wakeLockState}
          onTestAlert={ride.testAlert}
          onEndRide={ride.endRide}
          onOpenStop={selectStop}
        />
      )}

      {sharedPlace && (
        <MyPlaces
          stops={stops}
          coordinatesStatus={coordinatesStatus}
          activeStopId={stopId}
          placesById={placesById}
          sharedPlace={sharedPlace}
          serviceBoundary={serviceBoundary}
          online={online}
          onSavePlace={savePlace}
          onImportSharedPlace={importSharedPlace}
          onDismissSharedPlace={dismissSharedPlace}
          onRemovePlace={removePlace}
          onSetPrimaryStop={setPrimaryStop}
          onOpenStop={selectStop}
        />
      )}

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
          coordinatesStatus={coordinatesStatus}
          onSubmit={selectStop}
        />
      </section>

      <QuickStops
        favorites={favorites}
        recents={recents}
        activeStopId={stopId}
        onSelect={selectStop}
      />

      {stopId && (
        <>
          <ServiceAlerts
            alerts={serviceAlerts}
            error={serviceAlertsError}
            receivedAtMs={serviceAlertsReceivedAtMs}
          />

          <BusStopDisplay
            stopId={stopId}
            stopName={displayStopName}
            stop={selectedStop}
            stops={stops}
            arrivals={arrivals}
            routesById={routesById}
            routesByShortName={routesByShortName}
            serverTime={serverTime}
            receivedAtMs={receivedAtMs}
            realtimeAvailable={realtimeAvailable}
            scheduleAvailable={scheduleAvailable}
            loading={loading}
            refreshing={refreshing}
            error={error}
            onRefresh={() => refresh()}
            isFavorite={favoriteIds.has(stopId)}
            onToggleFavorite={() =>
              currentStop && toggleFavorite(currentStop)
            }
            placesById={placesById}
            onStartRide={ride.startRide}
            activeRideTripRef={ride.session?.tripRef || ""}
          />

          <NearbyStops
            stops={stops}
            coordinatesStatus={coordinatesStatus}
            activeStopId={stopId}
            serviceBoundary={serviceBoundary}
            online={online}
            onSelect={selectStop}
          />
        </>
      )}

      {!sharedPlace && (
        <MyPlaces
          stops={stops}
          coordinatesStatus={coordinatesStatus}
          activeStopId={stopId}
          placesById={placesById}
          sharedPlace={sharedPlace}
          serviceBoundary={serviceBoundary}
          online={online}
          onSavePlace={savePlace}
          onImportSharedPlace={importSharedPlace}
          onDismissSharedPlace={dismissSharedPlace}
          onRemovePlace={removePlace}
          onSetPrimaryStop={setPrimaryStop}
          onOpenStop={selectStop}
        />
      )}

      <footer className="source-note">
        Independent app · Data: Turku region public transport ·{" "}
        <a href="https://data.foli.fi/" target="_blank" rel="noreferrer">
          data.foli.fi
        </a>{" "}
        ·{" "}
        <a
          href="https://creativecommons.org/licenses/by/4.0/"
          target="_blank"
          rel="noreferrer"
        >
          CC BY 4.0
        </a>
      </footer>
    </main>
  );
}

export default App;
