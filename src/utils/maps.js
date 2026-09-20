function coordinate(value, min, max) {
  if (value === null || value === undefined || value === "") return null;

  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max
    ? number
    : null;
}

export function buildWalkingDirectionsUrl(stop) {
  const lat = coordinate(stop?.lat, -90, 90);
  const lon = coordinate(stop?.lon, -180, 180);

  if (lat === null || lon === null) return "";

  const params = new URLSearchParams({
    api: "1",
    destination: `${lat},${lon}`,
    travelmode: "walking",
    dir_action: "navigate",
  });

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
