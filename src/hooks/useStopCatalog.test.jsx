import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import {
  fetchStopCatalog,
  fetchStopCoordinates,
} from "../api/foliApi";
import useStopCatalog from "./useStopCatalog";

vi.mock("../api/foliApi", () => ({
  fetchStopCatalog: vi.fn(),
  fetchStopCoordinates: vi.fn(),
}));

const CACHE_KEY = "foli-stop-catalog-v2";

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  vi.mocked(fetchStopCatalog).mockReset();
  vi.mocked(fetchStopCoordinates).mockReset();
});

test("uses a fresh coordinate-complete cache without unnecessary provider requests", () => {
  const savedAt = Date.now();
  localStorage.setItem(
    CACHE_KEY,
    JSON.stringify({
      savedAt,
      stops: [
        {
          id: "164",
          name: "Kauppatori",
          lat: 60.4518,
          lon: 22.2666,
        },
      ],
    })
  );

  const { result } = renderHook(() => useStopCatalog());

  expect(result.current.stops).toEqual([
    expect.objectContaining({ id: "164", name: "Kauppatori" }),
  ]);
  expect(result.current.catalogStatus).toBe("ready");
  expect(result.current.coordinatesStatus).toBe("ready");
  expect(result.current.catalogSavedAt).toBe(savedAt);
  expect(fetchStopCatalog).not.toHaveBeenCalled();
  expect(fetchStopCoordinates).not.toHaveBeenCalled();
});

test("refreshes a stale cache and exposes the new catalogue version only after success", async () => {
  const staleSavedAt = Date.now() - 2 * 24 * 60 * 60 * 1000;
  localStorage.setItem(
    CACHE_KEY,
    JSON.stringify({
      savedAt: staleSavedAt,
      stops: [{ id: "164", name: "Old market" }],
    })
  );

  vi.mocked(fetchStopCoordinates).mockResolvedValue(
    new Map([["164", { lat: 60.4518, lon: 22.2666 }]])
  );
  vi.mocked(fetchStopCatalog).mockResolvedValue([
    { id: "164", name: "Kauppatori" },
  ]);

  const { result } = renderHook(() => useStopCatalog());

  expect(result.current.catalogStatus).toBe("stale");

  await waitFor(() => {
    expect(result.current.catalogStatus).toBe("ready");
  });

  expect(result.current.catalogSavedAt).toBeGreaterThan(staleSavedAt);
  expect(result.current.stops).toEqual([
    {
      id: "164",
      name: "Kauppatori",
      lat: 60.4518,
      lon: 22.2666,
    },
  ]);
});

test("keeps stale stop search usable when catalogue refresh fails", async () => {
  const staleSavedAt = Date.now() - 2 * 24 * 60 * 60 * 1000;
  localStorage.setItem(
    CACHE_KEY,
    JSON.stringify({
      savedAt: staleSavedAt,
      stops: [
        {
          id: "164",
          name: "Cached Kauppatori",
          lat: 60.4518,
          lon: 22.2666,
        },
      ],
    })
  );

  vi.mocked(fetchStopCatalog).mockRejectedValue(
    new Error("catalogue temporarily unavailable")
  );
  vi.mocked(fetchStopCoordinates).mockRejectedValue(
    new Error("coordinates temporarily unavailable")
  );

  const { result } = renderHook(() => useStopCatalog());

  await waitFor(() => {
    expect(result.current.catalogStatus).toBe("stale");
  });

  expect(result.current.stops).toEqual([
    expect.objectContaining({
      id: "164",
      name: "Cached Kauppatori",
    }),
  ]);
  expect(result.current.catalogSavedAt).toBe(staleSavedAt);
  expect(result.current.coordinatesStatus).toBe("ready");
});
