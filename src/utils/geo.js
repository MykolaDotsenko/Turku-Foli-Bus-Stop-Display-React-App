const EARTH_RADIUS_METERS = 6_371_008.8;

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function coordinate(value, min, max) {
  if (value === null || value === undefined || value === "") return null;

  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max
    ? number
    : null;
}

export function hasCoordinates(value) {
  return (
    coordinate(value?.lat, -90, 90) !== null &&
    coordinate(value?.lon, -180, 180) !== null
  );
}

export function distanceInMeters(from, to) {
  const fromLat = coordinate(from?.lat, -90, 90);
  const fromLon = coordinate(from?.lon, -180, 180);
  const toLat = coordinate(to?.lat, -90, 90);
  const toLon = coordinate(to?.lon, -180, 180);

  if (
    fromLat === null ||
    fromLon === null ||
    toLat === null ||
    toLon === null
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
  const clamped = Math.min(1, Math.max(0, a));
  const centralAngle =
    2 * Math.atan2(Math.sqrt(clamped), Math.sqrt(1 - clamped));

  return EARTH_RADIUS_METERS * centralAngle;
}

export function findNearestStops(stops, position, limit = 3) {
  if (!hasCoordinates(position) || limit <= 0) return [];

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

  if (distanceMeters < 10) return "<10 m";

  if (distanceMeters < 1_000) {
    return `${Math.round(distanceMeters / 10) * 10} m`;
  }

  const kilometers = distanceMeters / 1_000;
  return `${kilometers < 10 ? kilometers.toFixed(1) : Math.round(kilometers)} km`;
}

export function formatAccuracy(accuracyMeters) {
  if (!Number.isFinite(accuracyMeters) || accuracyMeters < 0) return "";
  return formatDistance(accuracyMeters);
}


function pointOnSegment(point, start, end, epsilon = 1e-10) {
  const [x, y] = point;
  const [x1, y1] = start;
  const [x2, y2] = end;
  const cross = (x - x1) * (y2 - y1) - (y - y1) * (x2 - x1);

  if (Math.abs(cross) > epsilon) return false;

  return (
    x >= Math.min(x1, x2) - epsilon &&
    x <= Math.max(x1, x2) + epsilon &&
    y >= Math.min(y1, y2) - epsilon &&
    y <= Math.max(y1, y2) + epsilon
  );
}

function pointInRing(point, ring) {
  if (!Array.isArray(ring) || ring.length < 4) return false;

  let inside = false;
  const [x, y] = point;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const current = ring[i];
    const previous = ring[j];

    if (
      !Array.isArray(current) ||
      current.length < 2 ||
      !Array.isArray(previous) ||
      previous.length < 2
    ) {
      continue;
    }

    if (pointOnSegment(point, previous, current)) return true;

    const [xi, yi] = current;
    const [xj, yj] = previous;
    const crosses =
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;

    if (crosses) inside = !inside;
  }

  return inside;
}

export function isInsideMultiPolygon(position, geometry) {
  const lat = coordinate(position?.lat, -90, 90);
  const lon = coordinate(position?.lon, -180, 180);

  if (
    lat === null ||
    lon === null ||
    geometry?.type !== "MultiPolygon" ||
    !Array.isArray(geometry.coordinates)
  ) {
    return null;
  }

  const point = [lon, lat];

  return geometry.coordinates.some((polygon) => {
    if (!Array.isArray(polygon) || polygon.length === 0) return false;

    const [outer, ...holes] = polygon;
    if (!pointInRing(point, outer)) return false;

    return !holes.some((hole) => pointInRing(point, hole));
  });
}
