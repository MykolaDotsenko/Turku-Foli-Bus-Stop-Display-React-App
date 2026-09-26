const VERSION = 1;
const ALLOWED_PLACE_IDS = new Set(["home", "school", "work"]);
const MAX_STOPS = 3;
const MAX_STOP_NAME_LENGTH = 80;

function cleanStopName(value, id) {
  const cleaned = String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_STOP_NAME_LENGTH);

  // Carried in the link and saved on import, so it stays the same in every
  // language.
  return cleaned || `Stop ${id}`;
}

function normalizeSharedPlace(place) {
  if (!place || typeof place !== "object") return null;

  const id = String(place.id || place.p || "").trim();
  if (!ALLOWED_PLACE_IDS.has(id)) return null;

  const sourceStops = Array.isArray(place.stops)
    ? place.stops
    : Array.isArray(place.s)
      ? place.s.map((stop) =>
          Array.isArray(stop) ? { id: stop[0], name: stop[1] } : stop
        )
      : [];

  const seenStopIds = new Set();
  const stops = sourceStops
    .map((stop) => {
      const stopId = String(stop?.id || "").trim();
      if (!/^\d+$/.test(stopId) || seenStopIds.has(stopId)) return null;

      seenStopIds.add(stopId);
      return {
        id: stopId,
        name: cleanStopName(stop?.name, stopId),
      };
    })
    .filter(Boolean)
    .slice(0, MAX_STOPS);

  if (stops.length === 0) return null;

  const requestedPrimary = String(
    place.primaryStopId || place.m || ""
  ).trim();
  const primaryStopId = stops.some((stop) => stop.id === requestedPrimary)
    ? requestedPrimary
    : stops[0].id;

  return { id, stops, primaryStopId };
}

function base64UrlEncode(value) {
  const bytes = new globalThis.TextEncoder().encode(value);
  let binary = "";

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return globalThis.btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(value) {
  const padded = value
    .replaceAll("-", "+")
    .replaceAll("_", "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = globalThis.atob(padded);
  const bytes = Uint8Array.from(binary, (character) =>
    character.charCodeAt(0)
  );

  return new globalThis.TextDecoder().decode(bytes);
}

export function encodeSharedPlace(place) {
  const normalized = normalizeSharedPlace(place);
  if (!normalized) return "";

  const payload = {
    v: VERSION,
    p: normalized.id,
    m: normalized.primaryStopId,
    s: normalized.stops.map((stop) => [stop.id, stop.name]),
  };

  return base64UrlEncode(JSON.stringify(payload));
}

export function decodeSharedPlace(token) {
  if (typeof token !== "string" || token.length === 0 || token.length > 2048) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(token));
    if (payload?.v !== VERSION) return null;
    return normalizeSharedPlace(payload);
  } catch {
    return null;
  }
}

export function parseSharedPlaceHash(hash) {
  const raw = String(hash || "").replace(/^#/, "");
  const token = new URLSearchParams(raw).get("place");
  return decodeSharedPlace(token || "");
}

export function buildSharedPlaceUrl(place, currentHref) {
  const token = encodeSharedPlace(place);
  if (!token) return "";

  const href =
    currentHref ||
    (typeof window !== "undefined" ? window.location.href : "");
  if (!href) return "";

  const url = new globalThis.URL(href);
  url.search = "";
  url.hash = `place=${token}`;
  return url.toString();
}

export function clearSharedPlaceHash() {
  if (typeof window === "undefined") return;

  const url = new globalThis.URL(window.location.href);
  if (!url.hash) return;

  url.hash = "";
  window.history.replaceState(null, "", url);
}
