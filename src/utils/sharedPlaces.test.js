import { expect, test } from "vitest";
import {
  buildSharedPlaceUrl,
  decodeSharedPlace,
  encodeSharedPlace,
  parseSharedPlaceHash,
} from "./sharedPlaces";

test("shares only public safe-stop identity and strips coordinates", () => {
  const token = encodeSharedPlace({
    id: "home",
    primaryStopId: "164",
    stops: [
      {
        id: "164",
        name: "Kauppatori",
        lat: 60.4518,
        lon: 22.2666,
        distanceMeters: 20,
      },
      { id: "32", name: "Puistokatu" },
    ],
  });

  const decoded = decodeSharedPlace(token);

  expect(decoded).toEqual({
    id: "home",
    primaryStopId: "164",
    stops: [
      { id: "164", name: "Kauppatori" },
      { id: "32", name: "Puistokatu" },
    ],
  });
  expect(token).not.toContain("60.4518");
  expect(JSON.stringify(decoded)).not.toContain("lat");
  expect(JSON.stringify(decoded)).not.toContain("lon");
});

test("uses the URL fragment and removes unrelated query state from a share link", () => {
  const url = buildSharedPlaceUrl(
    {
      id: "school",
      primaryStopId: "32",
      stops: [{ id: "32", name: "Puistokatu" }],
    },
    "https://example.test/?stop=164"
  );
  const parsed = new globalThis.URL(url);

  expect(parsed.search).toBe("");
  expect(parsed.hash).toMatch(/^#place=/);
  expect(parseSharedPlaceHash(parsed.hash)).toEqual({
    id: "school",
    primaryStopId: "32",
    stops: [{ id: "32", name: "Puistokatu" }],
  });
});

test("rejects malformed, unsupported and empty shared places", () => {
  expect(decodeSharedPlace("not-valid-base64")).toBeNull();
  expect(encodeSharedPlace({ id: "secret", stops: [{ id: "1" }] })).toBe("");
  expect(encodeSharedPlace({ id: "home", stops: [] })).toBe("");
});
