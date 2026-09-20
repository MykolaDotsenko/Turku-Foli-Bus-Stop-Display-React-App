import { expect, test } from "vitest";
import {
  distanceInMeters,
  findNearestStops,
  formatDistance,
} from "./geo";

test("calculates realistic short WGS84 distances", () => {
  const distance = distanceInMeters(
    { lat: 60.4518, lon: 22.2666 },
    { lat: 60.4527, lon: 22.2666 }
  );

  expect(distance).toBeGreaterThan(95);
  expect(distance).toBeLessThan(105);
});

test("orders nearby stops by straight-line distance", () => {
  const stops = [
    { id: "4", name: "Farther", lat: 60.455, lon: 22.2666 },
    { id: "164", name: "Nearest", lat: 60.4519, lon: 22.2666 },
    { id: "32", name: "Middle", lat: 60.453, lon: 22.2666 },
    { id: "99", name: "No coordinates" },
  ];

  const nearby = findNearestStops(
    stops,
    { lat: 60.4518, lon: 22.2666 },
    3
  );

  expect(nearby.map((stop) => stop.id)).toEqual(["164", "32", "4"]);
  expect(nearby.every((stop) => Number.isFinite(stop.distanceMeters))).toBe(
    true
  );
});

test("formats distance without implying false precision", () => {
  expect(formatDistance(84)).toBe("80 m");
  expect(formatDistance(1_420)).toBe("1.4 km");
  expect(formatDistance(12_400)).toBe("12 km");
});
