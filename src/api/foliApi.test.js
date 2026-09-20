import { beforeEach, expect, test, vi } from "vitest";

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
  fetchStopCatalog,
  fetchStopCoordinates,
  fetchStopMonitor,
} from "./foliApi";

beforeEach(() => {
  mocks.get.mockReset();
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
  mocks.get.mockResolvedValue({
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

    if (url === "https://data.foli.fi/gtfs/stops") {
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
  mocks.get.mockResolvedValue({
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
          monitored: true,
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
    })
  );
});
