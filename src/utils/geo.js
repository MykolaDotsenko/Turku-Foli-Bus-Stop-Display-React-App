const EARTH_RADIUS_METERS = 6_371_008.8;

function toRadians(value) {
  return (value * Math.PI) / 180;
}

export function hasCoordinates(stop) {
  return (
    Number.isFinite(Number(stop?.lat)) &&
    Number.isFinite(Number(stop?.lon)) &&
    Number(stop.lat) >= -90 &&
    Number(stop.lat) <= 90 &&
    Number(stop.lon) >= -180 &&
    Number(stop.lon) <= 180
  );
}

export function distanceInMeters(from, to) {
  const fromLat = Number(from?.lat);
  const fromLon = Number(from?.lon);
  const toLat = Number(to?.lat);
  const toLon = Number(to?.lon);

  if (
    !Number.isFinite(fromLat) ||
    !Number.isFinite(fromLon) ||
    !Number.isFinite(toLat) ||
    !Number.isFinite(toLon)
  ) {
    return null;
  }

  const deltaLat = toRadians(toLat - fromLat);
  const deltaLon = toRadians(toLon - fromLon);
  const lat1 = toRadians(fromLat);
  const lat2 = toRadians(toLat);

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  const centralAngle = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * centralAngle;
}

export function findNearestStops(stops, position, limit = 3) {
  if (!position || limit <= 0) return [];

  return stops
    .filter(hasCoordinates)
    .map((stop) => ({
      ...stop,
      distanceMeters: distanceInMeters(position, {
        lat: stop.lat,
        lon: stop.lon,
      }),
    }))
    .filter((stop) => Number.isFinite(stop.distanceMeters))
    .sort(
      (a, b) =>
        a.distanceMeters - b.distanceMeters ||
        Number(a.id) - Number(b.id)
    )
    .slice(0, limit);
}

export function formatDistance(distanceMeters) {
  if (!Number.isFinite(distanceMeters) || distanceMeters < 0) return "";

  if (distanceMeters < 1_000) {
    const rounded = Math.max(10, Math.round(distanceMeters / 10) * 10);
    return `${rounded} m`;
  }

  const kilometers = distanceMeters / 1_000;
  return `${kilometers < 10 ? kilometers.toFixed(1) : Math.round(kilometers)} km`;
}

export function formatAccuracy(accuracyMeters) {
  if (!Number.isFinite(accuracyMeters) || accuracyMeters < 0) return "";
  return formatDistance(accuracyMeters);
}
