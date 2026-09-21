import { expect, test } from "vitest";
import { retryDelayMs, ridePollDelayMs } from "./retry";

test("backs off repeated recovery attempts without exceeding five minutes", () => {
  expect(retryDelayMs(1)).toBe(5_000);
  expect(retryDelayMs(2)).toBe(10_000);
  expect(retryDelayMs(3)).toBe(20_000);
  expect(retryDelayMs(6)).toBe(160_000);
  expect(retryDelayMs(7)).toBe(300_000);
  expect(retryDelayMs(50)).toBe(300_000);
});

test("treats a missing or unusable failure count as the first attempt", () => {
  expect(retryDelayMs(0)).toBe(5_000);
  expect(retryDelayMs(-3)).toBe(5_000);
  expect(retryDelayMs(undefined)).toBe(5_000);
  expect(retryDelayMs("not a number")).toBe(5_000);
});

test("keeps an active ride polling fast until failures repeat", () => {
  // No jitter, so the shape of the curve is what is under test.
  const steady = () => 0.5;

  expect(ridePollDelayMs(0, steady)).toBe(20_000);
  expect(ridePollDelayMs(1, steady)).toBe(20_000);
  expect(ridePollDelayMs(2, steady)).toBe(40_000);
  expect(ridePollDelayMs(3, steady)).toBe(80_000);
});

test("never backs a ride off past the point live tracking is declared lost", () => {
  const steady = () => 0.5;

  // trackingHealth gives up on live data at 120s, so a longer gap would mean
  // the panel could never notice the provider coming back.
  for (const failures of [4, 8, 20, 500]) {
    expect(ridePollDelayMs(failures, steady)).toBeLessThan(120_000);
  }
  expect(ridePollDelayMs(500, steady)).toBe(80_000);
});

test("spreads retries with jitter and survives unusable counts", () => {
  expect(ridePollDelayMs(3, () => 0)).toBe(68_000);
  expect(ridePollDelayMs(3, () => 1)).toBe(92_000);

  expect(ridePollDelayMs(undefined)).toBe(20_000);
  expect(ridePollDelayMs("not a number")).toBe(20_000);
  expect(ridePollDelayMs(-5)).toBe(20_000);
});
