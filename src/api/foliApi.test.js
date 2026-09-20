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

import { fetchStopCatalog, fetchStopCoordinates } from "./foliApi";

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
