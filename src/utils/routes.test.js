import { expect, test } from "vitest";
import {
  accessibleRouteTextColor,
  buildRouteIndexes,
  contrastRatio,
} from "./routes";

test("keeps provider text color when it satisfies WCAG AA contrast", () => {
  expect(accessibleRouteTextColor("#0b3d4a", "#ffffff")).toBe("#ffffff");
  expect(contrastRatio("#ffffff", "#0b3d4a")).toBeGreaterThanOrEqual(4.5);
});

test("corrects an unreadable provider route text color", () => {
  expect(accessibleRouteTextColor("#ffff00", "#ffffff")).toBe("#000000");
});

test("indexes route metadata by GTFS id and public line name", () => {
  const route = {
    id: "1",
    shortName: "1",
    longName: "Satama–Kauppatori–Lentoasema",
  };
  const indexes = buildRouteIndexes([route]);

  expect(indexes.byId.get("1")).toBe(route);
  expect(indexes.byShortName.get("1")).toBe(route);
});
