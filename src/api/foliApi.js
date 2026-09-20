import axios from "axios";
import { extractStopAlerts } from "../utils/alerts";

const API_BASE_URL =
  import.meta.env.VITE_FOLI_API_URL || "https://data.foli.fi/siri/sm";
const ALERTS_URL =
  import.meta.env.VITE_FOLI_ALERTS_URL || "https://data.foli.fi/alerts";
const STOPS_URL =
  import.meta.env.VITE_FOLI_STOPS_URL || "https://data.foli.fi/gtfs/stops";

const client = axios.create({
  timeout: 8000,
  headers: { Accept: "application/json" },
});

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
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max
    ? number
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
    monitored: arrival.monitored === true,
    delay: optionalNumber(arrival.delay),
    recordedattime: positiveNumber(arrival.recordedattime),
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

function stopCoordinates(payload) {
  if (!payload || Array.isArray(payload) || typeof payload !== "object") {
    return new Map();
  }

  return new Map(
    Object.entries(payload)
      .map(([id, stop]) => {
        const lat = coordinateNumber(stop?.stop_lat, -90, 90);
        const lon = coordinateNumber(stop?.stop_lon, -180, 180);

        return lat === null || lon === null
          ? null
          : [String(id), { lat, lon }];
      })
      .filter(Boolean)
  );
}

export async function fetchStopCatalog(signal) {
  const [monitorResult, gtfsResult] = await Promise.allSettled([
    client.get(API_BASE_URL, { signal }),
    client.get(STOPS_URL, { signal }),
  ]);

  if (monitorResult.status === "rejected") {
    throw monitorResult.reason;
  }

  if (signal?.aborted) {
    throw new DOMException("Stop catalogue request aborted.", "AbortError");
  }

  const payload = monitorResult.value.data;

  if (!payload || Array.isArray(payload) || typeof payload !== "object") {
    throw new Error("Invalid Föli stop list.");
  }

  const coordinates =
    gtfsResult.status === "fulfilled"
      ? stopCoordinates(gtfsResult.value.data)
      : new Map();

  return Object.entries(payload)
    .map(([id, stop]) => {
      const coordinate = coordinates.get(String(id));

      return {
        id: String(id),
        name:
          typeof stop?.stop_name === "string" && stop.stop_name.trim()
            ? stop.stop_name.trim()
            : `Stop ${id}`,
        lat: coordinate?.lat ?? null,
        lon: coordinate?.lon ?? null,
      };
    })
    .filter((stop) => /^\d+$/.test(stop.id))
    .sort((a, b) => Number(a.id) - Number(b.id));
}

export async function fetchStopAlerts(stopId, signal) {
  const response = await client.get(ALERTS_URL, { signal });
  return extractStopAlerts(response.data, stopId);
}
