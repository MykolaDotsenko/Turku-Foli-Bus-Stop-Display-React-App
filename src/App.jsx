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
import useServiceBoundary from "./hooks/useServiceBoundary";
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

function stopUrl(stopId) {
  const url = new globalThis.URL(window.location.href);
  url.searchParams.set("stop", stopId);
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
    const canonicalizeInvalidLocation = () => {
      const stopFromUrl = new URLSearchParams(window.location.search).get("stop");

      if (!/^\d+$/.test(stopFromUrl || "")) {
        canonicalizeCurrentStop(DEFAULT_STOP);
      }
    };

    // Do not rewrite an already-valid initial URL while the document is still
    // loading. Preserving that browser-created history entry is what makes
    // native Back/Forward traversal reliable across engines. Invalid or
    // missing stop links are canonicalized only after the initial load entry
    // has settled.
    if (document.readyState === "complete") {
      canonicalizeInvalidLocation();
    } else {
      window.addEventListener("load", canonicalizeInvalidLocation, {
        once: true,
      });
    }

    const handlePopState = () => {
      const nextStopId = stopFromLocation();
      const stopFromUrl = new URLSearchParams(window.location.search).get("stop");

      if (!/^\d+$/.test(stopFromUrl || "")) {
        canonicalizeCurrentStop(nextStopId);
      }

      // The shareable URL is the single source of truth for browser history.
      setStopId(nextStopId);
    };
    const handleHashChange = () =>
      setSharedPlace(parseSharedPlaceHash(window.location.hash));

    window.addEventListener("popstate", handlePopState);
    window.addEventListener("hashchange", handleHashChange);

    return () => {
      window.removeEventListener("load", canonicalizeInvalidLocation);
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

    // The URL is the navigation source of truth. Add exactly one history entry
    // per user-selected stop; do not replace the current entry immediately
    // before pushing, because that can make Back/Forward traversal brittle.
    window.history.pushState(null, "", stopUrl(nextStopId));
    setStopId(nextStopId);
  };

  const currentStop = {
    id: stopId,
    name: displayStopName || `Stop ${stopId}`,
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
          <p className="eyebrow">Independent companion · Föli open data</p>
          <p className="brand">Föli departures</p>
          <p className="context">
            Find a stop, save Home, School or Work without remembering an
            address, and get back to the right journey in one tap.
          </p>
        </div>
        <span
          className="live-pill"
          data-online={online ? "true" : "false"}
          aria-live="polite"
        >
          <span className="live-dot" aria-hidden="true" />
          {online ? "Föli SIRI" : "Offline mode"}
        </span>
      </header>

      <ConnectivityStatus online={online} />

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
          onSubmit={selectStop}
        />
      </section>

      <QuickStops
        favorites={favorites}
        recents={recents}
        activeStopId={stopId}
        onSelect={selectStop}
      />

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
        routesByShortName={routesByShortName}
        serverTime={serverTime}
        receivedAtMs={receivedAtMs}
        loading={loading}
        refreshing={refreshing}
        error={error}
        onRefresh={() => refresh()}
        isFavorite={favoriteIds.has(stopId)}
        onToggleFavorite={() => toggleFavorite(currentStop)}
      />

      <NearbyStops
        stops={stops}
        coordinatesStatus={coordinatesStatus}
        activeStopId={stopId}
        serviceBoundary={serviceBoundary}
        online={online}
        onSelect={selectStop}
      />

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
