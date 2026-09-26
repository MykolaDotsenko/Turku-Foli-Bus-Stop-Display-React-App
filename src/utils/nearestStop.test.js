import { expect, test } from "vitest";
import { judgeNearestStop } from "./nearestStop";

const kauppatori = { id: "164", name: "Kauppatori", lat: 60.4518, lon: 22.2666 };
const puistokatu = { id: "32", name: "Puistokatu", lat: 60.4488, lon: 22.255 };
const stops = [kauppatori, puistokatu];

test("trusts an accurate fix close to one clearly nearest stop", () => {
  const result = judgeNearestStop(stops, {
    lat: 60.45182,
    lon: 22.26662,
    accuracy: 12,
  });

  expect(result.verdict).toBe("confident");
  expect(result.stop.id).toBe("164");
});

test("does not pick a stop from an approximate fix", () => {
  expect(
    judgeNearestStop(stops, { lat: 60.45182, lon: 22.26662, accuracy: 3_000 })
      .verdict
  ).toBe("approximate");
});

test("does not pick a stop kilometres away", () => {
  // Helsinki, with an accurate fix: the nearest Turku stop is 150 km off.
  expect(
    judgeNearestStop(stops, { lat: 60.1699, lon: 24.9384, accuracy: 10 })
      .verdict
  ).toBe("far");
});

test("does not pick between two stops the fix cannot tell apart", () => {
  const across = { id: "165", name: "Kauppatori", lat: 60.45185, lon: 22.26675 };

  expect(
    judgeNearestStop([kauppatori, across], {
      lat: 60.45183,
      lon: 22.26668,
      accuracy: 30,
    }).verdict
  ).toBe("ambiguous");
});

test("does not pick a stop outside the published service area", () => {
  const farAway = {
    type: "MultiPolygon",
    coordinates: [
      [
        [
          [0, 0],
          [0, 1],
          [1, 1],
          [1, 0],
          [0, 0],
        ],
      ],
    ],
  };

  expect(
    judgeNearestStop(
      stops,
      { lat: 60.45182, lon: 22.26662, accuracy: 12 },
      farAway
    ).verdict
  ).toBe("outside-area");
});
