import { expect, test } from "vitest";
import createBoundedCache from "./boundedCache";

test("evicts the least recently used entry instead of growing without bound", () => {
  const cache = createBoundedCache(2);

  cache.set("a", 1);
  cache.set("b", 2);
  cache.set("c", 3);

  expect(cache.size).toBe(2);
  expect(cache.has("a")).toBe(false);
  expect(cache.get("b")).toBe(2);
  expect(cache.get("c")).toBe(3);
});

test("reading an entry protects it from the next eviction", () => {
  const cache = createBoundedCache(2);

  cache.set("a", 1);
  cache.set("b", 2);
  cache.get("a");
  cache.set("c", 3);

  expect(cache.has("a")).toBe(true);
  expect(cache.has("b")).toBe(false);
});

test("rewriting a key refreshes it without duplicating the entry", () => {
  const cache = createBoundedCache(2);

  cache.set("a", 1);
  cache.set("b", 2);
  cache.set("a", 11);
  cache.set("c", 3);

  expect(cache.size).toBe(2);
  expect(cache.get("a")).toBe(11);
  expect(cache.has("b")).toBe(false);
});

test("clears every entry and always keeps at least one usable slot", () => {
  const cache = createBoundedCache(0);

  cache.set("a", 1);
  cache.set("b", 2);
  expect(cache.size).toBe(1);

  cache.clear();
  expect(cache.size).toBe(0);
  expect(cache.get("b")).toBeUndefined();
  expect(cache.has("b")).toBe(false);
});
