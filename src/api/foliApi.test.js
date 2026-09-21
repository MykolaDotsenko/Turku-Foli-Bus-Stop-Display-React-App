import { afterEach, beforeEach, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
}));

vi.mock("axios", () => ({
  default: {
    create: () => ({
      get: mocks.get,
    }),
  },
}));

import {
  fetchRouteCatalog,
  fetchServiceBoundary,
  fetchStopCatalog,
  fetchStopCoordinates,
  fetchStopMonitor,
  fetchStopServedRouteIds,
  fetchTripDetails,
  fetchTripShape,
  fetchTripStopTimes,
  resetGtfsDatasetForTests,
} from "./foliApi";

const datasetMeta = {
  host: "data.foli.fi",
  gtfspath: "/gtfs/v0",
  latest: "20260920-120000",
};

const datasetBase = "https://data.foli.fi/gtfs/v0/20260920-120000";

beforeEach(() => {
  mocks.get.mockReset();
  resetGtfsDatasetForTests();
});

afterEach(() => {
  vi.useRealTimers();
});

test("keeps the active SIRI stop catalogue independent from GTFS coordinates", async () => {
  mocks.get.mockImplementation((url) => {
    if (url === "https://data.foli.fi/siri/sm") {
      return Promise.resolve({
        data: {
          "164": { stop_name: "Kauppatori" },
          "4": { stop_name: "Turun linna" },
        },
      });
    }

    return Promise.reject(new Error("Unexpected URL"));
  });

  const stops = await fetchStopCatalog();

  expect(stops).toEqual([
    { id: "4", name: "Turun linna" },
    { id: "164", name: "Kauppatori" },
  ]);
  expect(mocks.get).toHaveBeenCalledTimes(1);
});

test("normalizes valid GTFS WGS84 stop coordinates", async () => {
  mocks.get.mockImplementation((url) => {
    if (url === "https://data.foli.fi/gtfs/") {
      return Promise.resolve({ data: datasetMeta });
    }

    if (url === `${datasetBase}/stops`) {
      return Promise.resolve({
        data: {
          "164": {
            stop_name: "Kauppatori",
            stop_lat: 60.4518,
            stop_lon: 22.2666,
          },
          "4": {
            stop_name: "Turun linna",
            stop_lat: 60.4355,
            stop_lon: 22.2345,
          },
          "99": {
            stop_name: "Invalid",
            stop_lat: null,
            stop_lon: "",
          },
        },
      });
    }

    return Promise.reject(new Error(`Unexpected URL: ${url}`));
  });

  const coordinates = await fetchStopCoordinates();

  expect(coordinates.get("164")).toEqual({
    lat: 60.4518,
    lon: 22.2666,
  });
  expect(coordinates.get("4")).toEqual({
    lat: 60.4355,
    lon: 22.2345,
  });
  expect(coordinates.has("99")).toBe(false);
});

test("a GTFS failure cannot prevent normal stop search data from loading", async () => {
  mocks.get.mockImplementation((url) => {
    if (url === "https://data.foli.fi/siri/sm") {
      return Promise.resolve({
        data: {
          "164": { stop_name: "Kauppatori" },
        },
      });
    }

    if (url === "https://data.foli.fi/gtfs/") {
      return Promise.reject(new Error("GTFS temporarily unavailable"));
    }

    return Promise.reject(new Error("Unexpected URL"));
  });

  const [catalogResult, coordinateResult] = await Promise.allSettled([
    fetchStopCatalog(),
    fetchStopCoordinates(),
  ]);

  expect(catalogResult).toEqual({
    status: "fulfilled",
    value: [{ id: "164", name: "Kauppatori" }],
  });
  expect(coordinateResult.status).toBe("rejected");
});

test("normalizes route identity and official Föli colors", async () => {
  mocks.get.mockImplementation((url) => {
    if (url === "https://data.foli.fi/gtfs/") {
      return Promise.resolve({ data: datasetMeta });
    }

    if (url === `${datasetBase}/routes`) {
      return Promise.resolve({
        data: [
          {
            route_id: "1",
            route_short_name: "1",
            route_long_name: "Satama-Kauppatori-Lentoasema",
            route_type: 3,
            route_color: "0bbbef",
            route_text_color: "ffffff",
          },
          {
            route_id: "180",
            route_short_name: "180",
            route_long_name: "Waterbus",
            route_type: 4,
            route_color: "invalid",
            route_text_color: "",
          },
        ],
      });
    }

    return Promise.reject(new Error(`Unexpected URL: ${url}`));
  });

  const routes = await fetchRouteCatalog();

  expect(routes).toEqual([
    {
      id: "1",
      shortName: "1",
      longName: "Satama-Kauppatori-Lentoasema",
      type: 3,
      color: "#0bbbef",
      textColor: "#ffffff",
    },
    {
      id: "180",
      shortName: "180",
      longName: "Waterbus",
      type: 4,
      color: null,
      textColor: null,
    },
  ]);
});

test("normalizes trip shape geometry and keeps GTFS traveled distance", async () => {
  mocks.get.mockImplementation((url) => {
    if (url === "https://data.foli.fi/gtfs/") {
      return Promise.resolve({ data: datasetMeta });
    }

    if (url === `${datasetBase}/shapes/shape-1`) {
      return Promise.resolve({
        data: [
          { lat: 60.4518, lon: 22.2666, traveled: 0 },
          { lat: 60.45, lon: 22.26, traveled: 420.5 },
          { lat: null, lon: 22.2, traveled: 500 },
        ],
      });
    }

    return Promise.reject(new Error(`Unexpected URL: ${url}`));
  });

  await expect(fetchTripShape("shape-1")).resolves.toEqual([
    { lat: 60.4518, lon: 22.2666, traveled: 0 },
    { lat: 60.45, lon: 22.26, traveled: 420.5 },
  ]);

  // Dataset-scoped shape data is cached like trip metadata.
  await fetchTripShape("shape-1");
  expect(
    mocks.get.mock.calls.filter(([url]) => url === `${datasetBase}/shapes/shape-1`)
  ).toHaveLength(1);
});

test("normalizes stop_times shape_dist_traveled for route-distance tracking", async () => {
  mocks.get.mockImplementation((url) => {
    if (url === "https://data.foli.fi/gtfs/") {
      return Promise.resolve({ data: datasetMeta });
    }

    if (url === `${datasetBase}/stop_times/trip/trip-shape`) {
      return Promise.resolve({
        data: [
          {
            stop_id: "164",
            arrival_time: "17:40:00",
            departure_time: "17:41:00",
            stop_sequence: 1,
            shape_dist_traveled: 125.25,
          },
          {
            stop_id: "32",
            arrival_time: "17:46:00",
            departure_time: "17:46:00",
            stop_sequence: 2,
            shape_dist_traveled: 987.75,
          },
        ],
      });
    }

    return Promise.reject(new Error(`Unexpected URL: ${url}`));
  });

  const stopTimes = await fetchTripStopTimes("trip-shape");
  expect(stopTimes.map((item) => item.shapeDistTraveled)).toEqual([
    125.25,
    987.75,
  ]);
});

test("fills an empty SIRI board from the active GTFS timetable", async () => {
  const reference = Date.parse("2026-09-21T12:15:00Z") / 1000;

  mocks.get.mockImplementation((url) => {
    if (url === "https://data.foli.fi/siri/sm/621") {
      return Promise.resolve({
        data: {
          status: "OK",
          servertime: reference,
          stopname: "Takakirves",
          result: [],
        },
      });
    }

    if (url === "https://data.foli.fi/gtfs/") {
      return Promise.resolve({ data: datasetMeta });
    }

    if (url === `${datasetBase}/stop_times/stop/621`) {
      return Promise.resolve({
        data: [
          {
            trip_id: "trip-32",
            arrival_time: "15:20:00",
            departure_time: "15:20:00",
            stop_sequence: 12,
            pickup_type: 0,
            drop_off_type: 0,
          },
          {
            trip_id: "trip-inactive",
            arrival_time: "15:25:00",
            departure_time: "15:25:00",
            stop_sequence: 13,
            pickup_type: 0,
            drop_off_type: 0,
          },
        ],
      });
    }

    if (url === `${datasetBase}/calendar`) {
      return Promise.resolve({
        data: {
          weekday: {
            monday: 1,
            tuesday: 1,
            wednesday: 1,
            thursday: 1,
            friday: 1,
            saturday: 0,
            sunday: 0,
            start_date: "20260901",
            end_date: "20260930",
          },
          sunday: {
            monday: 0,
            tuesday: 0,
            wednesday: 0,
            thursday: 0,
            friday: 0,
            saturday: 0,
            sunday: 1,
            start_date: "20260901",
            end_date: "20260930",
          },
        },
      });
    }

    if (url === `${datasetBase}/calendar_dates`) {
      return Promise.resolve({ data: {} });
    }

    if (url === `${datasetBase}/routes`) {
      return Promise.resolve({
        data: [
          {
            route_id: "route-32",
            route_short_name: "32",
            route_long_name: "Pansio–Varissuo",
            route_type: 3,
          },
        ],
      });
    }

    if (url === `${datasetBase}/trips/trip/trip-32`) {
      return Promise.resolve({
        data: [
          {
            route_id: "route-32",
            service_id: "weekday",
            trip_headsign: "Varissuo",
            block_id: "block-32",
          },
        ],
      });
    }

    if (url === `${datasetBase}/trips/trip/trip-inactive`) {
      return Promise.resolve({
        data: [
          {
            route_id: "route-32",
            service_id: "sunday",
            trip_headsign: "Varissuo",
          },
        ],
      });
    }

    return Promise.reject(new Error(`Unexpected URL: ${url}`));
  });

  const result = await fetchStopMonitor("621");

  expect(result.stopName).toBe("Takakirves");
  expect(result.realtimeAvailable).toBe(true);
  expect(result.scheduleAvailable).toBe(true);
  expect(result.arrivals).toHaveLength(1);
  expect(result.arrivals[0]).toEqual(
    expect.objectContaining({
      lineref: "32",
      destinationdisplay: "Varissuo",
      monitored: false,
      tripref: "trip-32",
      routeref: "route-32",
      aimeddeparturetime: Date.parse("2026-09-21T12:20:00Z") / 1000,
    })
  );
});

test("falls back to GTFS when SIRI itself is temporarily unavailable", async () => {
  const reference = Date.parse("2026-09-21T12:15:00Z") / 1000;

  mocks.get.mockImplementation((url) => {
    if (url === "https://data.foli.fi/siri/sm/621") {
      return Promise.resolve({
        data: {
          status: "NO_SIRI_DATA",
          servertime: reference,
          stopname: "Takakirves",
          result: [],
        },
      });
    }

    if (url === "https://data.foli.fi/gtfs/") {
      return Promise.resolve({ data: datasetMeta });
    }

    if (url === `${datasetBase}/stop_times/stop/621`) {
      return Promise.resolve({
        data: [
          {
            trip_id: "trip-32",
            arrival_time: "15:20:00",
            departure_time: "15:20:00",
            stop_sequence: 12,
            pickup_type: 0,
          },
        ],
      });
    }

    if (url === `${datasetBase}/calendar`) {
      return Promise.resolve({
        data: {
          weekday: {
            monday: 1,
            tuesday: 1,
            wednesday: 1,
            thursday: 1,
            friday: 1,
            saturday: 0,
            sunday: 0,
            start_date: "20260901",
            end_date: "20260930",
          },
          sunday: {
            monday: 0,
            tuesday: 0,
            wednesday: 0,
            thursday: 0,
            friday: 0,
            saturday: 0,
            sunday: 1,
            start_date: "20260901",
            end_date: "20260930",
          },
        },
      });
    }

    if (url === `${datasetBase}/calendar_dates`) {
      return Promise.resolve({ data: {} });
    }

    if (url === `${datasetBase}/routes`) {
      return Promise.resolve({
        data: [
          {
            route_id: "route-32",
            route_short_name: "32",
            route_type: 3,
          },
        ],
      });
    }

    if (url === `${datasetBase}/trips/trip/trip-32`) {
      return Promise.resolve({
        data: [
          {
            route_id: "route-32",
            service_id: "weekday",
            trip_headsign: "Varissuo",
          },
        ],
      });
    }

    return Promise.reject(new Error(`Unexpected URL: ${url}`));
  });

  const result = await fetchStopMonitor("621");

  expect(result.realtimeAvailable).toBe(false);
  expect(result.arrivals).toHaveLength(1);
  expect(result.arrivals[0].monitored).toBe(false);
});

test("reuses pinned GTFS timetable data across realtime refreshes", async () => {
  const reference = Date.parse("2026-09-21T12:15:00Z") / 1000;

  mocks.get.mockImplementation((url) => {
    if (url === "https://data.foli.fi/siri/sm/621") {
      return Promise.resolve({
        data: {
          status: "OK",
          servertime: reference,
          stopname: "Takakirves",
          result: [],
        },
      });
    }
    if (url === "https://data.foli.fi/gtfs/") {
      return Promise.resolve({ data: datasetMeta });
    }
    if (url === `${datasetBase}/stop_times/stop/621`) {
      return Promise.resolve({
        data: [
          {
            trip_id: "trip-32",
            departure_time: "15:20:00",
            arrival_time: "15:20:00",
            pickup_type: 0,
          },
        ],
      });
    }
    if (url === `${datasetBase}/calendar`) {
      return Promise.resolve({
        data: {
          weekday: {
            monday: 1,
            tuesday: 1,
            wednesday: 1,
            thursday: 1,
            friday: 1,
            saturday: 0,
            sunday: 0,
            start_date: "20260901",
            end_date: "20260930",
          },
          sunday: {
            monday: 0,
            tuesday: 0,
            wednesday: 0,
            thursday: 0,
            friday: 0,
            saturday: 0,
            sunday: 1,
            start_date: "20260901",
            end_date: "20260930",
          },
        },
      });
    }

    if (url === `${datasetBase}/calendar_dates`) {
      return Promise.resolve({ data: {} });
    }
    if (url === `${datasetBase}/routes`) {
      return Promise.resolve({
        data: [{ route_id: "route-32", route_short_name: "32", route_type: 3 }],
      });
    }
    if (url === `${datasetBase}/trips/trip/trip-32`) {
      return Promise.resolve({
        data: [
          {
            route_id: "route-32",
            service_id: "weekday",
            trip_headsign: "Varissuo",
          },
        ],
      });
    }
    return Promise.reject(new Error(`Unexpected URL: ${url}`));
  });

  await fetchStopMonitor("621");
  await fetchStopMonitor("621");

  expect(
    mocks.get.mock.calls.filter(
      ([url]) => url === "https://data.foli.fi/siri/sm/621"
    )
  ).toHaveLength(2);
  expect(
    mocks.get.mock.calls.filter(
      ([url]) => url === `${datasetBase}/stop_times/stop/621`
    )
  ).toHaveLength(1);
  expect(
    mocks.get.mock.calls.filter(
      ([url]) => url === `${datasetBase}/calendar`
    )
  ).toHaveLength(1);
  expect(
    mocks.get.mock.calls.filter(
      ([url]) => url === `${datasetBase}/calendar_dates`
    )
  ).toHaveLength(1);
  expect(
    mocks.get.mock.calls.filter(
      ([url]) => url === `${datasetBase}/routes`
    )
  ).toHaveLength(1);
  expect(
    mocks.get.mock.calls.filter(
      ([url]) => url === `${datasetBase}/trips/trip/trip-32`
    )
  ).toHaveLength(1);
});

test("keeps monitored vehicle coordinates from SIRI stop monitoring", async () => {
  mocks.get.mockResolvedValue({
    data: {
      status: "OK",
      servertime: 1900000000,
      stopname: "Kauppatori",
      result: [
        {
          lineref: "1",
          destinationdisplay: "Satama",
          destinationdisplay_en: "Harbour",
          destinationdisplay_sv: "Hamnen",
          monitored: true,
          vehicleatstop: true,
          vehicleref: "bus-1",
          incongestion: true,
          __tripref: "trip-1",
          latitude: 60.453,
          longitude: 22.2666,
          recordedattime: 1899999990,
          expecteddeparturetime: 1900000300,
          aimeddeparturetime: 1900000270,
          originaimeddeparturetime: 1899999000,
          destinationaimedarrivaltime: 1900002000,
        },
      ],
    },
  });

  const result = await fetchStopMonitor("164");

  expect(result.arrivals[0]).toEqual(
    expect.objectContaining({
      lineref: "1",
      latitude: 60.453,
      longitude: 22.2666,
      originaimeddeparturetime: 1899999000,
      destinationaimedarrivaltime: 1900002000,
      destinationdisplay_en: "Harbour",
      destinationdisplay_sv: "Hamnen",
      vehicleatstop: true,
      vehicleref: "bus-1",
      incongestion: true,
      tripref: "trip-1",
    })
  );
});


test("pins GTFS stops and routes to the same dataset metadata lookup", async () => {
  mocks.get.mockImplementation((url) => {
    if (url === "https://data.foli.fi/gtfs/") {
      return Promise.resolve({ data: datasetMeta });
    }

    if (url === `${datasetBase}/stops`) {
      return Promise.resolve({
        data: {
          "164": {
            stop_name: "Kauppatori",
            stop_lat: 60.4518,
            stop_lon: 22.2666,
          },
        },
      });
    }

    if (url === `${datasetBase}/routes`) {
      return Promise.resolve({
        data: [
          {
            route_id: "1",
            route_short_name: "1",
            route_long_name: "Test",
            route_type: 3,
          },
        ],
      });
    }

    return Promise.reject(new Error(`Unexpected URL: ${url}`));
  });

  const [coordinates, routes] = await Promise.all([
    fetchStopCoordinates(),
    fetchRouteCatalog(),
  ]);

  expect(coordinates.has("164")).toBe(true);
  expect(routes[0].shortName).toBe("1");
  expect(
    mocks.get.mock.calls.filter(([url]) => url === "https://data.foli.fi/gtfs/")
  ).toHaveLength(1);
  expect(mocks.get).toHaveBeenCalledWith(
    `${datasetBase}/stops`,
    expect.any(Object)
  );
  expect(mocks.get).toHaveBeenCalledWith(
    `${datasetBase}/routes`,
    expect.any(Object)
  );
});

test("loads trip metadata and planned stop sequence from the pinned dataset", async () => {
  mocks.get.mockImplementation((url) => {
    if (url === "https://data.foli.fi/gtfs/") {
      return Promise.resolve({ data: datasetMeta });
    }
    if (url === `${datasetBase}/trips/trip/trip-1`) {
      return Promise.resolve({
        data: [
          {
            route_id: "1",
            service_id: "weekday",
            trip_headsign: "Runosmäki",
            direction_id: 1,
            block_id: "block-1",
            shape_id: "shape-1",
            wheelchair_accessible: 1,
            bikes_allowed: 0,
          },
        ],
      });
    }
    if (url === `${datasetBase}/stop_times/trip/trip-1`) {
      return Promise.resolve({
        data: [
          {
            stop_id: "164",
            arrival_time: "17:40:00",
            departure_time: "17:41:00",
            stop_sequence: 1,
            pickup_type: 0,
            drop_off_type: 0,
            timepoint: 1,
          },
          {
            stop_id: "32",
            arrival_time: "17:46:00",
            departure_time: "17:46:00",
            stop_sequence: 2,
            pickup_type: 0,
            drop_off_type: 0,
            timepoint: 0,
          },
        ],
      });
    }
    return Promise.reject(new Error(`Unexpected URL: ${url}`));
  });

  const details = await fetchTripDetails("trip-1");
  const stops = await fetchTripStopTimes("trip-1");

  expect(details).toEqual(
    expect.objectContaining({
      tripId: "trip-1",
      headsign: "Runosmäki",
      wheelchairAccessible: 1,
    })
  );
  expect(stops).toEqual([
    expect.objectContaining({ stopId: "164", timepoint: 1 }),
    expect.objectContaining({ stopId: "32", timepoint: 0 }),
  ]);
});

test("derives route membership from boardable stop-times only", async () => {
  mocks.get.mockImplementation((url) => {
    if (url === "https://data.foli.fi/gtfs/") {
      return Promise.resolve({ data: datasetMeta });
    }
    if (url === `${datasetBase}/stop_times/stop/164`) {
      return Promise.resolve({
        data: [
          { trip_id: "trip-board", pickup_type: 0 },
          { trip_id: "trip-dropoff-only", pickup_type: 1 },
        ],
      });
    }
    if (url === `${datasetBase}/trips/route/route-a`) {
      return Promise.resolve({ data: [{ trip_id: "trip-board" }] });
    }
    if (url === `${datasetBase}/trips/route/route-b`) {
      return Promise.resolve({ data: [{ trip_id: "trip-dropoff-only" }] });
    }
    return Promise.reject(new Error(`Unexpected URL: ${url}`));
  });

  const served = await fetchStopServedRouteIds(
    "164",
    ["route-a", "route-b"]
  );

  expect([...served]).toEqual(["route-a"]);
});

test("normalizes the compact Föli service boundary", async () => {
  mocks.get.mockImplementation((url) => {
    if (url === "https://data.foli.fi/geojson/bounds/compact") {
      return Promise.resolve({
        data: {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              geometry: {
                type: "MultiPolygon",
                coordinates: [[[[22, 60], [23, 60], [23, 61], [22, 60]]]],
              },
            },
          ],
        },
      });
    }
    return Promise.reject(new Error(`Unexpected URL: ${url}`));
  });

  await expect(fetchServiceBoundary()).resolves.toEqual({
    type: "MultiPolygon",
    coordinates: [[[[22, 60], [23, 60], [23, 61], [22, 60]]]],
  });
});

test("rejects malformed realtime payloads instead of presenting partial data", async () => {
  mocks.get.mockResolvedValueOnce({ data: { status: "OK", result: "not-an-array" } });
  await expect(fetchStopMonitor("164")).rejects.toThrow(
    "Invalid Föli departures."
  );

  mocks.get.mockResolvedValueOnce({ data: { status: "ERROR", result: [] } });
  await expect(fetchStopMonitor("164")).rejects.toThrow(
    "Föli real-time data is unavailable."
  );
});

test("filters malformed arrival rows while keeping a valid realtime response usable", async () => {
  mocks.get.mockResolvedValue({
    data: {
      status: "OK",
      servertime: 1900000000,
      stopname: "Kauppatori",
      result: [
        null,
        [],
        "broken",
        {
          lineref: "1",
          destinationdisplay: "Satama",
          monitored: false,
          aimeddeparturetime: 1900000300,
        },
      ],
    },
  });

  const result = await fetchStopMonitor("164");
  expect(result.arrivals).toHaveLength(1);
  expect(result.arrivals[0].lineref).toBe("1");
});

test("re-resolves the pinned GTFS dataset after its TTL and drops rows cached from the retired dataset", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-21T00:00:00Z"));

  let latest = "20260920-120000";
  const tripUrls = [];

  mocks.get.mockImplementation((url) => {
    if (url === "https://data.foli.fi/gtfs/") {
      return Promise.resolve({ data: { ...datasetMeta, latest } });
    }

    if (url.includes("/trips/trip/")) {
      tripUrls.push(url);
      return Promise.resolve({ data: [{ route_id: "1", trip_headsign: "Satama" }] });
    }

    return Promise.reject(new Error(`Unexpected URL ${url}`));
  });

  await fetchTripDetails("trip-1");
  await fetchTripDetails("trip-1");

  expect(tripUrls).toHaveLength(1);
  expect(tripUrls[0]).toContain("/20260920-120000/");

  // Föli publishes a new dataset while this session is still open.
  latest = "20260921-120000";
  vi.setSystemTime(new Date("2026-09-21T07:00:00Z"));

  await fetchTripDetails("trip-1");

  expect(tripUrls).toHaveLength(2);
  expect(tripUrls[1]).toContain("/20260921-120000/");
});

test("re-reads rows once after the pin expires, against the confirmed dataset", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-21T00:00:00Z"));

  const tripUrls = [];

  mocks.get.mockImplementation((url) => {
    if (url === "https://data.foli.fi/gtfs/") {
      return Promise.resolve({ data: datasetMeta });
    }

    if (url.includes("/trips/trip/")) {
      tripUrls.push(url);
      return Promise.resolve({ data: [{ route_id: "1" }] });
    }

    return Promise.reject(new Error(`Unexpected URL ${url}`));
  });

  await fetchTripDetails("trip-1");
  await fetchTripDetails("trip-1");
  expect(tripUrls).toHaveLength(1);

  vi.setSystemTime(new Date("2026-09-21T07:00:00Z"));
  await fetchTripDetails("trip-1");
  await fetchTripDetails("trip-1");

  // One re-read after the pin expires, then cached again against the
  // dataset that was just confirmed.
  expect(tripUrls).toHaveLength(2);
  expect(tripUrls[1]).toContain("/20260920-120000/");
});
