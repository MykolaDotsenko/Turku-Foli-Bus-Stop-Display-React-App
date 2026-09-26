import { renderHook } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import useRouteCatalog from "./useRouteCatalog";

vi.mock("../api/foliApi", () => ({
  fetchRouteCatalog: vi.fn(() => new Promise(() => {})),
}));

beforeEach(() => {
  localStorage.clear();
});

test("skips saved routes that are not routes instead of crashing on them", () => {
  localStorage.setItem(
    "foli-route-catalog-v1",
    JSON.stringify({
      savedAt: Date.now(),
      routes: [null, 7, { shortName: "7" }, { id: "1", shortName: "1" }],
    })
  );

  const { result } = renderHook(() => useRouteCatalog());

  expect(result.current).toEqual([{ id: "1", shortName: "1" }]);
});
