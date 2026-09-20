import { expect, test } from "vitest";
import { buildTransitDirectionsUrl, buildWalkingDirectionsUrl } from "./maps";

test("builds keyless walking directions without leaking the user's origin", () => {
  const url = buildWalkingDirectionsUrl({
    id: "164",
    lat: 60.4518,
    lon: 22.2666,
  });
  const parsed = new globalThis.URL(url);

  expect(parsed.origin).toBe("https://www.google.com");
  expect(parsed.pathname).toBe("/maps/dir/");
  expect(parsed.searchParams.get("api")).toBe("1");
  expect(parsed.searchParams.get("destination")).toBe("60.4518,22.2666");
  expect(parsed.searchParams.get("travelmode")).toBe("walking");
  expect(parsed.searchParams.get("dir_action")).toBe("navigate");
  expect(parsed.searchParams.has("origin")).toBe(false);
});

test("does not build a directions link without valid coordinates", () => {
  expect(buildWalkingDirectionsUrl({ lat: null, lon: 22.2 })).toBe("");
  expect(buildWalkingDirectionsUrl({ lat: 60.45, lon: undefined })).toBe("");
});


test("builds keyless transit directions to a public stop without an origin", () => {
  const url = buildTransitDirectionsUrl({
    lat: 60.4518,
    lon: 22.2666,
  });
  const parsed = new globalThis.URL(url);

  expect(parsed.searchParams.get("destination")).toBe("60.4518,22.2666");
  expect(parsed.searchParams.get("travelmode")).toBe("transit");
  expect(parsed.searchParams.has("origin")).toBe(false);
  expect(parsed.searchParams.has("dir_action")).toBe(false);
});
