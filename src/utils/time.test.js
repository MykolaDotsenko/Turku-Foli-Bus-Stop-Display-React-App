import { expect, test } from "vitest";
import {
  advanceServerTime,
  elapsedSince,
  formatElapsedAge,
  formatServiceStatus,
} from "./time";

test("advances the provider clock by elapsed client time after receipt", () => {
  expect(advanceServerTime(1_000, 10_000, 190_000)).toBe(1_180);
});

test("keeps realtime freshness aging during an outage", () => {
  const effectiveServerTime = advanceServerTime(1_000, 10_000, 190_000);

  expect(
    formatServiceStatus(true, 0, 990, effectiveServerTime)
  ).toContain("3 min old");
});

test("formats receipt age without pretending missing timestamps exist", () => {
  expect(elapsedSince(10_000, 190_000)).toBe(180);
  expect(formatElapsedAge(20)).toBe("just now");
  expect(formatElapsedAge(80)).toBe("1 min ago");
  expect(formatElapsedAge(180)).toBe("3 min ago");
  expect(formatElapsedAge(null)).toBe("");
});
