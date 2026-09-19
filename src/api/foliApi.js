import axios from "axios";

const API_BASE_URL =
  process.env.REACT_APP_FOLI_API_URL || "https://data.foli.fi/siri/sm";

const client = axios.create({
  timeout: 8000,
  headers: { Accept: "application/json" },
});

export async function fetchStopMonitor(stopId, signal) {
  const response = await client.get(
    `${API_BASE_URL}/${encodeURIComponent(stopId)}`,
    { signal }
  );
  const payload = response.data;

  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid Föli response.");
  }

  if (payload.status !== "OK") {
    throw new Error("Föli real-time data is unavailable.");
  }

  if (!Array.isArray(payload.result)) {
    throw new Error("Invalid Föli departures.");
  }

  return {
    stopName: payload.stopname || `Stop ${stopId}`,
    arrivals: payload.result,
    serverTime: payload.servertime || null,
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
      id,
      name: stop?.stop_name || `Stop ${id}`,
    }))
    .sort((a, b) => Number(a.id) - Number(b.id));
}
