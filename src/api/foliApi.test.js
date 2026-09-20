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

import { fetchStopCatalog } from "./foliApi";

beforeEach(() => {
  mocks.get.mockReset();
});

test("joins GTFS WGS84 coordinates onto active SIRI stops", async () => {
  mocks.get.mockImplementation((url) => {
    if (url === "https://data.foli.fi/siri/sm") {
      return Promise.resolve({
        data: {
          "164": { stop_name: "Kauppatori" },
          "4": { stop_name: "Turun linna" },
        },
      });
    }

    if (url === "https://data.foli.fi/gtfs/stops") {
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
        },
      });
    }

    return Promise.reject(new Error("Unexpected URL"));
  });

  const stops = await fetchStopCatalog();

  expect(stops).toEqual([
    {
      id: "4",
      name: "Turun linna",
      lat: 60.4355,
      lon: 22.2345,
    },
    {
      id: "164",
      name: "Kauppatori",
      lat: 60.4518,
      lon: 22.2666,
    },
  ]);
});

test("keeps normal stop search usable when GTFS coordinates fail", async () => {
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

  const stops = await fetchStopCatalog();

  expect(stops).toEqual([
    {
      id: "164",
      name: "Kauppatori",
      lat: null,
      lon: null,
    },
  ]);
});
