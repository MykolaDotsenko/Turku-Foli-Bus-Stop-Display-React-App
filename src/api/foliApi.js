import axios from "axios";
import createBoundedCache from "../utils/boundedCache";

const API_BASE_URL =
  import.meta.env.VITE_FOLI_API_URL || "https://data.foli.fi/siri/sm";
const ALERTS_URL =
  import.meta.env.VITE_FOLI_ALERTS_URL || "https://data.foli.fi/alerts";
const GTFS_BASE_URL =
  import.meta.env.VITE_FOLI_GTFS_URL || "https://data.foli.fi/gtfs/";
const STOPS_URL_OVERRIDE = import.meta.env.VITE_FOLI_STOPS_URL || "";
const ROUTES_URL_OVERRIDE = import.meta.env.VITE_FOLI_ROUTES_URL || "";
const SERVICE_BOUNDARY_URL =
  import.meta.env.VITE_FOLI_BOUNDARY_URL ||
  "https://data.foli.fi/geojson/bounds/compact";

const client = axios.create({
  timeout: 8000,
  headers: { Accept: "application/json" },
});

// Föli publishes new GTFS dataset versions, so a long-lived session must not
// keep requesting a retired dataset path for the rest of its life.
const GTFS_DATASET_TTL_MS = 6 * 60 * 60 * 1000;

// Dataset-scoped responses. Bounded so a display left running for days cannot
// grow its memory without limit.
const tripDetailsCache = createBoundedCache(200);
const tripStopTimesCache = createBoundedCache(60);
const stopBoardingTripsCache = createBoundedCache(20);
const routeTripsCache = createBoundedCache(60);

let gtfsDatasetBasePromise = null;
let gtfsDatasetBaseUrl = "";
let gtfsDatasetResolvedAtMs = 0;

function clearGtfsResourceCaches() {
  tripDetailsCache.clear();
  tripStopTimesCache.clear();
  stopBoardingTripsCache.clear();
  routeTripsCache.clear();
}

/**
 * Drops an expired dataset pin, and everything cached against it, without
 * waiting on the network. Cached reads stay synchronous, and no response from
 * a retired dataset can outlive the pin.
 */
function invalidateExpiredGtfsDataset() {
  const expired =
    gtfsDatasetResolvedAtMs > 0 &&
    Date.now() - gtfsDatasetResolvedAtMs >= GTFS_DATASET_TTL_MS;

  if (!expired) return;

  gtfsDatasetBasePromise = null;
  gtfsDatasetResolvedAtMs = 0;
  clearGtfsResourceCaches();
}

function gtfsDatasetBase() {
  invalidateExpiredGtfsDataset();

  if (!gtfsDatasetBasePromise) {
    gtfsDatasetBasePromise = client
      .get(GTFS_BASE_URL)
      .then(({ data }) => {
        const host = optionalString(data?.host);
        const path = optionalString(data?.gtfspath);
        const latest = optionalString(data?.latest);

        if (!host || !path || !latest || !/^[\w.-]+$/.test(latest)) {
          throw new Error("Invalid Föli GTFS dataset metadata.");
        }

        const normalizedPath = path.startsWith("/") ? path : `/${path}`;
        const base = `https://${host}${normalizedPath}/${encodeURIComponent(
          latest
        )}`;

        if (gtfsDatasetBaseUrl && gtfsDatasetBaseUrl !== base) {
          // Everything cached from the previous dataset is now unrelated.
          clearGtfsResourceCaches();
        }

        gtfsDatasetBaseUrl = base;
        gtfsDatasetResolvedAtMs = Date.now();
        return base;
      })
      .catch((error) => {
        gtfsDatasetBasePromise = null;
        gtfsDatasetResolvedAtMs = 0;
        throw error;
      });
  }

  return gtfsDatasetBasePromise;
}

async function gtfsResourceUrl(resource, overrideUrl) {
  if (overrideUrl) return overrideUrl;
  return `${await gtfsDatasetBase()}/${resource}`;
}

export function resetGtfsDatasetForTests() {
  gtfsDatasetBasePromise = null;
  gtfsDatasetBaseUrl = "";
  gtfsDatasetResolvedAtMs = 0;
  clearGtfsResourceCaches();
}

function positiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function optionalNumber(value) {
  if (value === null || value === undefined || value === "") return null;

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function coordinateNumber(value, min, max) {
  if (value === null || value === undefined || value === "") return null;

  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max
    ? number
    : null;
}

function optionalString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function gtfsColor(value) {
  const normalized = optionalString(value).replace(/^#/, "");
  return /^[0-9a-f]{6}$/i.test(normalized)
    ? `#${normalized.toLowerCase()}`
    : null;
}

function normalizeArrival(arrival) {
  if (!arrival || Array.isArray(arrival) || typeof arrival !== "object") {
    return null;
  }

  return {
    lineref:
      typeof arrival.lineref === "string" || typeof arrival.lineref === "number"
        ? String(arrival.lineref)
        : "",
    destinationdisplay:
      typeof arrival.destinationdisplay === "string"
        ? arrival.destinationdisplay
        : "",
    destinationdisplay_en: optionalString(arrival.destinationdisplay_en),
    destinationdisplay_sv: optionalString(arrival.destinationdisplay_sv),
    monitored: arrival.monitored === true,
    vehicleatstop: arrival.vehicleatstop === true,
    vehicleref:
      arrival.vehicleref === null || arrival.vehicleref === undefined
        ? ""
        : String(arrival.vehicleref),
    incongestion: arrival.incongestion === true,
    directionname: optionalString(arrival.directionname),
    destinationref:
      arrival.destinationref === null || arrival.destinationref === undefined
        ? ""
        : String(arrival.destinationref),
    originref:
      arrival.originref === null || arrival.originref === undefined
        ? ""
        : String(arrival.originref),
    visitnumber: optionalNumber(arrival.visitnumber),
    blockref:
      arrival.blockref === null || arrival.blockref === undefined
        ? ""
        : String(arrival.blockref),
    dataframeref: optionalString(arrival.dataframeref),
    datedvehiclejourneyref: optionalString(arrival.datedvehiclejourneyref),
    tripref:
      arrival.__tripref === null || arrival.__tripref === undefined
        ? ""
        : String(arrival.__tripref),
    routeref:
      arrival.__routeref === null || arrival.__routeref === undefined
        ? ""
        : String(arrival.__routeref),
    delay: optionalNumber(arrival.delay),
    recordedattime: positiveNumber(arrival.recordedattime),
    latitude: coordinateNumber(arrival.latitude, -90, 90),
    longitude: coordinateNumber(arrival.longitude, -180, 180),
    originaimeddeparturetime: positiveNumber(arrival.originaimeddeparturetime),
    destinationaimedarrivaltime: positiveNumber(
      arrival.destinationaimedarrivaltime
    ),
    expecteddeparturetime: positiveNumber(arrival.expecteddeparturetime),
    expectedarrivaltime: positiveNumber(arrival.expectedarrivaltime),
    aimeddeparturetime: positiveNumber(arrival.aimeddeparturetime),
    aimedarrivaltime: positiveNumber(arrival.aimedarrivaltime),
  };
}

export async function fetchStopMonitor(stopId, signal) {
  const response = await client.get(
    `${API_BASE_URL}/${encodeURIComponent(stopId)}`,
    { signal }
  );
  const payload = response.data;

  if (!payload || Array.isArray(payload) || typeof payload !== "object") {
    throw new Error("Invalid Föli response.");
  }

  if (payload.status !== "OK") {
    throw new Error("Föli real-time data is unavailable.");
  }

  if (!Array.isArray(payload.result)) {
    throw new Error("Invalid Föli departures.");
  }

  return {
    stopName:
      typeof payload.stopname === "string" && payload.stopname.trim()
        ? payload.stopname.trim()
        : `Stop ${stopId}`,
    arrivals: payload.result.map(normalizeArrival).filter(Boolean),
    serverTime: positiveNumber(payload.servertime),
  };
}

export async function fetchStopCatalog(signal) {
  const response = await client.get(API_BASE_URL, { signal });
  const payload = response.data;

  if (!payload || Array.isArray(payload) || typeof payload !== "object") {
    throw new Error("Invalid Föli stop list.");
  }

  return Object.entries(payload)
    .map(([id, stop]) => ({
      id: String(id),
      name:
        typeof stop?.stop_name === "string" && stop.stop_name.trim()
          ? stop.stop_name.trim()
          : `Stop ${id}`,
    }))
    .filter((stop) => /^\d+$/.test(stop.id))
    .sort((a, b) => Number(a.id) - Number(b.id));
}

export async function fetchStopCoordinates(signal) {
  const response = await client.get(
    await gtfsResourceUrl("stops", STOPS_URL_OVERRIDE),
    { signal }
  );
  const payload = response.data;

  if (!payload || Array.isArray(payload) || typeof payload !== "object") {
    throw new Error("Invalid Föli GTFS stop list.");
  }

  const coordinates = new Map();

  Object.entries(payload).forEach(([id, stop]) => {
    const lat = coordinateNumber(stop?.stop_lat, -90, 90);
    const lon = coordinateNumber(stop?.stop_lon, -180, 180);

    if (lat !== null && lon !== null) {
      coordinates.set(String(id), { lat, lon });
    }
  });

  if (coordinates.size === 0) {
    throw new Error("Föli GTFS stop coordinates are unavailable.");
  }

  return coordinates;
}

export async function fetchRouteCatalog(signal) {
  const response = await client.get(
    await gtfsResourceUrl("routes", ROUTES_URL_OVERRIDE),
    { signal }
  );
  const payload = response.data;

  if (!Array.isArray(payload)) {
    throw new Error("Invalid Föli GTFS route list.");
  }

  return payload
    .map((route) => {
      const id =
        route?.route_id === null || route?.route_id === undefined
          ? ""
          : String(route.route_id);
      const shortName = optionalString(route?.route_short_name);

      return {
        id,
        shortName,
        longName: optionalString(route?.route_long_name),
        type: optionalNumber(route?.route_type),
        color: gtfsColor(route?.route_color),
        textColor: gtfsColor(route?.route_text_color),
      };
    })
    .filter((route) => route.id && route.shortName);
}

export async function fetchAlerts(signal) {
  const response = await client.get(ALERTS_URL, { signal });
  const payload = response.data;

  if (!payload || Array.isArray(payload) || typeof payload !== "object") {
    throw new Error("Invalid Föli alerts response.");
  }

  return payload;
}



function requiredId(value, label) {
  const id =
    value === null || value === undefined ? "" : String(value).trim();
  if (!id || id.length > 160) {
    throw new Error(`Invalid Föli ${label}.`);
  }
  return id;
}

function gtfsTime(value) {
  if (typeof value === "string" && /^\d{1,3}:\d{2}:\d{2}$/.test(value.trim())) {
    return value.trim();
  }
  return "";
}

export async function fetchTripDetails(tripId, signal) {
  const id = requiredId(tripId, "trip ID");
  invalidateExpiredGtfsDataset();
  if (tripDetailsCache.has(id)) return tripDetailsCache.get(id);
  const response = await client.get(
    await gtfsResourceUrl(`trips/trip/${encodeURIComponent(id)}`),
    { signal }
  );
  const payload = response.data;

  if (!Array.isArray(payload) || payload.length === 0) {
    throw new Error("Föli GTFS trip metadata is unavailable.");
  }

  const trip = payload[0];

  const normalized = {
    tripId: id,
    routeId:
      trip?.route_id === null || trip?.route_id === undefined
        ? ""
        : String(trip.route_id),
    serviceId:
      trip?.service_id === null || trip?.service_id === undefined
        ? ""
        : String(trip.service_id),
    headsign: optionalString(trip?.trip_headsign),
    directionId: optionalNumber(trip?.direction_id),
    blockId:
      trip?.block_id === null || trip?.block_id === undefined
        ? ""
        : String(trip.block_id),
    shapeId:
      trip?.shape_id === null || trip?.shape_id === undefined
        ? ""
        : String(trip.shape_id),
    wheelchairAccessible: optionalNumber(trip?.wheelchair_accessible),
    bikesAllowed: optionalNumber(trip?.bikes_allowed),
  };

  tripDetailsCache.set(id, normalized);
  return normalized;
}

export async function fetchTripStopTimes(tripId, signal) {
  const id = requiredId(tripId, "trip ID");
  invalidateExpiredGtfsDataset();
  if (tripStopTimesCache.has(id)) return tripStopTimesCache.get(id);
  const response = await client.get(
    await gtfsResourceUrl(`stop_times/trip/${encodeURIComponent(id)}`),
    { signal }
  );
  const payload = response.data;

  if (!Array.isArray(payload)) {
    throw new Error("Invalid Föli GTFS trip stop sequence.");
  }

  const normalized = payload
    .map((item) => ({
      stopId:
        item?.stop_id === null || item?.stop_id === undefined
          ? ""
          : String(item.stop_id),
      arrivalTime: gtfsTime(item?.arrival_time),
      departureTime: gtfsTime(item?.departure_time),
      stopSequence: optionalNumber(item?.stop_sequence),
      pickupType: optionalNumber(item?.pickup_type),
      dropOffType: optionalNumber(item?.drop_off_type),
      timepoint: optionalNumber(item?.timepoint),
    }))
    .filter((item) => item.stopId && item.stopSequence !== null)
    .sort((a, b) => a.stopSequence - b.stopSequence);

  tripStopTimesCache.set(id, normalized);
  return normalized;
}

export async function fetchStopBoardingTripIds(stopId, signal) {
  const id = requiredId(stopId, "stop ID");
  invalidateExpiredGtfsDataset();
  if (stopBoardingTripsCache.has(id)) {
    return new Set(stopBoardingTripsCache.get(id));
  }
  const response = await client.get(
    await gtfsResourceUrl(`stop_times/stop/${encodeURIComponent(id)}`),
    { signal }
  );
  const payload = response.data;

  if (!Array.isArray(payload)) {
    throw new Error("Invalid Föli GTFS stop timetable.");
  }

  const tripIds = payload
      .filter((item) => optionalNumber(item?.pickup_type) !== 1)
      .map((item) =>
        item?.trip_id === null || item?.trip_id === undefined
          ? ""
          : String(item.trip_id)
      )
      .filter(Boolean);

  stopBoardingTripsCache.set(id, tripIds);
  return new Set(tripIds);
}

export async function fetchRouteTripIds(routeId, signal) {
  const id = requiredId(routeId, "route ID");
  invalidateExpiredGtfsDataset();
  if (routeTripsCache.has(id)) return new Set(routeTripsCache.get(id));
  const response = await client.get(
    await gtfsResourceUrl(`trips/route/${encodeURIComponent(id)}`),
    { signal }
  );
  const payload = response.data;

  if (!Array.isArray(payload)) {
    throw new Error("Invalid Föli GTFS route trips.");
  }

  const tripIds = payload
      .map((trip) =>
        trip?.trip_id === null || trip?.trip_id === undefined
          ? ""
          : String(trip.trip_id)
      )
      .filter(Boolean);

  routeTripsCache.set(id, tripIds);
  return new Set(tripIds);
}

export async function fetchStopServedRouteIds(stopId, routeIds, signal) {
  const uniqueRouteIds = [
    ...new Set(
      (Array.isArray(routeIds) ? routeIds : [])
        .map((routeId) => String(routeId || "").trim())
        .filter(Boolean)
    ),
  ].slice(0, 32);

  if (uniqueRouteIds.length === 0) return new Set();

  const boardingTripIds = await fetchStopBoardingTripIds(stopId, signal);
  if (boardingTripIds.size === 0) return new Set();

  const routeTripSets = [];

  for (let index = 0; index < uniqueRouteIds.length; index += 6) {
    const batch = uniqueRouteIds.slice(index, index + 6);
    const results = await Promise.all(
      batch.map(async (routeId) => ({
        routeId,
        tripIds: await fetchRouteTripIds(routeId, signal),
      }))
    );
    routeTripSets.push(...results);
  }

  return new Set(
    routeTripSets
      .filter(({ tripIds }) =>
        [...tripIds].some((tripId) => boardingTripIds.has(tripId))
      )
      .map(({ routeId }) => routeId)
  );
}

export async function fetchServiceBoundary(signal) {
  const response = await client.get(SERVICE_BOUNDARY_URL, { signal });
  const payload = response.data;

  if (
    !payload ||
    payload.type !== "FeatureCollection" ||
    !Array.isArray(payload.features)
  ) {
    throw new Error("Invalid Föli service boundary.");
  }

  const feature = payload.features.find(
    (candidate) =>
      candidate?.geometry?.type === "MultiPolygon" &&
      Array.isArray(candidate.geometry.coordinates)
  );

  if (!feature) {
    throw new Error("Föli service boundary is unavailable.");
  }

  return {
    type: "MultiPolygon",
    coordinates: feature.geometry.coordinates,
  };
}
