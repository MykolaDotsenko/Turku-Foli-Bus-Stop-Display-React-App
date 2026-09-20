import { readFile } from "node:fs/promises";

const reference = await readFile("docs/FOLI_API_REFERENCE.md", "utf8");
const readme = await readFile("README.md", "utf8");
const provider = await readFile("src/api/foliApi.js", "utf8");
const smoke = await readFile(
  ".github/workflows/live-contract-smoke.yml",
  "utf8"
);

const requiredReferenceTokens = [
  "/gtfs/",
  "/gtfs/gtfs.zip",
  "/gtfs/agency",
  "/gtfs/stops",
  "/gtfs/routes",
  "/gtfs/calendar",
  "/gtfs/calendar_dates",
  "/gtfs/trips",
  "/trips/all",
  "/trips/route/<route_id>",
  "/trips/service/<service_id>",
  "/trips/trip/<trip_id>",
  "/gtfs/stop_times",
  "/stop_times/stop/<stop_id>",
  "/stop_times/trip/<trip_id>",
  "/gtfs/shapes",
  "/gtfs/trip_notes",
  "/gtfs/translations",
  "/siri/sm",
  "/siri/sm/<stop_id>",
  "/siri/vm",
  "/alerts",
  "/alerts/messages",
  "/alerts/cancellations",
  "/alerts/categories",
  "/geojson/layers",
  "/geojson/poi",
  "/geojson/bounds",
  "/geojson/bounds/strict",
  "/geojson/bounds/compact",
];

const missing = requiredReferenceTokens.filter(
  (token) => !reference.includes(token)
);

if (missing.length > 0) {
  throw new Error(
    `Föli API reference is missing required endpoint tokens: ${missing.join(", ")}`
  );
}

if (!readme.includes("docs/FOLI_API_REFERENCE.md")) {
  throw new Error("README must link to docs/FOLI_API_REFERENCE.md.");
}

if (!provider.includes('"https://data.foli.fi/gtfs/"')) {
  throw new Error(
    "Provider module must use the live-compatible trailing-slash GTFS metadata URL."
  );
}

if (!smoke.includes("getJson(\`\${base}/gtfs/\`)")) {
  throw new Error(
    "Live contract smoke must monitor the trailing-slash GTFS metadata URL."
  );
}

console.log(
  `Föli API reference drift gate passed (${requiredReferenceTokens.length} endpoint tokens checked).`
);
