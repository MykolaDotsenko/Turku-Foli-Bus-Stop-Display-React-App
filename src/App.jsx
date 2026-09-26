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


// The page's own title, from index.html, for when no stop is open.
const DEFAULT_TITLE =
  typeof document === "undefined" ? "" : document.title;

function stopFromLocation() {
  const stopFromUrl = new URLSearchParams(window.location.search).get("stop");
  return /^\d+$/.test(stopFromUrl || "") ? stopFromUrl : "";
}

// A shared-place token belongs to the page it arrived on. Carried into
// every stop URL, it put the "Add Home?" question back one Back press
// after "Not now". So an entry keeps it only while it is the page the link
// opened; leaving for another stop drops it from both entries.
function stopUrl(stopId, { keepSharedPlace = false } = {}) {
  const url = new globalThis.URL(window.location.href);

  if (/^\d+$/.test(stopId || "")) {
    url.searchParams.set("stop", stopId);
  } else {
    url.searchParams.delete("stop");
  }

  if (!keepSharedPlace && url.hash.startsWith("#place=")) {
    url.hash = "";
  }

  return `${url.pathname}${url.search}${url.hash}`;
}

function currentHistoryState() {
  return window.history.state && typeof window.history.state === "object"
    ? window.history.state
    : {};
}

function canonicalizeCurrentStop(stopId, options) {
  window.history.replaceState(
    currentHistoryState(),
    "",
    stopUrl(stopId, options)
  );
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
    scheduleFailed,
    scheduleIncomplete,
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
    canonicalizeCurrentStop(currentStopId, { keepSharedPlace: true });

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

  // Every stop used to share one title, so tabs, bookmarks and history
  // could not be told apart.
  useEffect(() => {
    document.title =
      stopId && displayStopName
        ? `${displayStopName} (${stopId}) · Föli departures`
        : DEFAULT_TITLE;
  }, [displayStopName, stopId]);

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
        <div className="brandLockup">
          {/* The favicon, and the source scripts/build-icons.mjs renders the
              home-screen and get-off notification icons from, so the mark
              someone tapped is the mark that greets them. Decorative here:
              the wordmark beside it already carries the name, so a second
              "Föli departures" for a screen reader would only repeat it. */}
          <img
            className="brandMark"
            src={`${import.meta.env.BASE_URL}foli-icon.svg`}
            alt=""
            width="48"
            height="48"
            decoding="async"
          />
          <div className="brandText">
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
        </div>
        {/* It only knows whether the phone can reach the internet, so it
            only speaks up when it cannot. "Live Föli data" stood above
            boards that had just said their live update failed. It stays
            in the page while online, out of sight, so going offline is
            still announced. */}
        <span
          className="live-pill"
          data-online={online ? "true" : "false"}
          aria-live="polite"
        >
          {online ? (
            "Online"
          ) : (
            <>
              <span className="live-dot" aria-hidden="true" />
              Offline mode
            </>
          )}
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
          serviceBoundary={serviceBoundary}
          onSubmit={selectStop}
        />
      </section>

      <QuickStops
        favorites={favorites}
        recents={recents}
        activeStopId={stopId}
        onSelect={selectStop}
      />

      {/* Before a stop is chosen, location is the quickest way to one. This
          used to appear only after a stop was chosen, which left a first
          visit with an unlabelled symbol in the search box. */}
      {!stopId && (
        <NearbyStops
          stops={stops}
          coordinatesStatus={coordinatesStatus}
          activeStopId=""
          serviceBoundary={serviceBoundary}
          online={online}
          onSelect={selectStop}
        />
      )}

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
            scheduleFailed={scheduleFailed === true}
            scheduleIncomplete={scheduleIncomplete === true}
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
        <p className="source-line">
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
        </p>

        {/* Trust needs one place that says who makes this, what stays on
            the phone and what leaves it. The facts were spread over a
            dozen fine-print lines, and "Independent app" was all a
            passenger saw without scrolling to the bottom. */}
        <details className="about">
          <summary>About &amp; privacy</summary>
          <dl>
            <dt>Who makes it</dt>
            <dd>
              An independent app, not made by or affiliated with Föli (Turku
              region public transport) or the City of Turku. For tickets and
              official journey planning, use Föli&apos;s own services.
            </dd>
            <dt>Where the times come from</dt>
            <dd>
              Föli open data at data.foli.fi, under CC BY 4.0. Live times are
              estimates from the buses and can change.
            </dd>
            <dt>What stays on this phone</dt>
            <dd>
              Favourites, recent stops, My Places (public stop numbers and
              names, never an address), the last few departure boards for up
              to 15 minutes, and a ride in progress for up to six hours.
              Clearing this site&apos;s data removes all of it.
            </dd>
            <dt>What leaves it</dt>
            <dd>
              Each stop you look up is requested from data.foli.fi, which
              sees your IP address and that stop. Your location is used only
              when you ask, stays on the phone and is never saved. Google Maps
              opens only when you tap a route link.
            </dd>
            <dt>What there is not</dt>
            <dd>No account, no ads, no analytics.</dd>
          </dl>
          <p>
            Feedback and source code:{" "}
            <a
              href="https://github.com/MykolaDotsenko/foli-live-departures/issues"
              target="_blank"
              rel="noreferrer"
            >
              GitHub
            </a>
          </p>
        </details>
      </footer>
    </main>
  );
}

export default App;
