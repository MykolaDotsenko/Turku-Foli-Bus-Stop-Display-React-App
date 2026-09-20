export function buildWalkingDirectionsUrl(stop) {
  const lat = Number(stop?.lat);
  const lon = Number(stop?.lon);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return "";

  const params = new URLSearchParams({
    api: "1",
    destination: `${lat},${lon}`,
    travelmode: "walking",
    dir_action: "navigate",
  });

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
