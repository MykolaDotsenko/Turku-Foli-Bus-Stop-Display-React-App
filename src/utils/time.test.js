import { expect, test } from "vitest";
import {
  advanceServerTime,
  elapsedSince,
  formatClock,
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

test("shows Turku-region clock times whatever zone the device is set to", () => {
  // A phone still on another zone must not report a bus leaving at the wrong
  // wall-clock time. Both sides of the Finnish DST switch are covered.
  const winterNoonUtc = Date.UTC(2026, 0, 15, 12, 0, 0) / 1000;
  const summerNoonUtc = Date.UTC(2026, 6, 15, 12, 0, 0) / 1000;

  expect(formatClock(winterNoonUtc, "en-GB")).toBe("14:00");
  expect(formatClock(summerNoonUtc, "en-GB")).toBe("15:00");
});

test("still refuses to invent a clock time for missing departures", () => {
  expect(formatClock(null)).toBe("—");
  expect(formatClock(0)).toBe("—");
  expect(formatClock("later")).toBe("—");
});
