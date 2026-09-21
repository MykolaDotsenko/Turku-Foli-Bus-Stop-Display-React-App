import { expect, test } from "vitest";
import { retryDelayMs } from "./retry";

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
