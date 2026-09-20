import { act, renderHook } from "@testing-library/react";
import { beforeEach, expect, test } from "vitest";
import useSavedStops from "./useSavedStops";

beforeEach(() => {
  localStorage.clear();
});

test("keeps favorites and recent stops local-first", () => {
  const { result } = renderHook(() => useSavedStops());

  act(() => {
    result.current.rememberRecent({ id: "164", name: "Kauppatori" });
    result.current.toggleFavorite({ id: "164", name: "Kauppatori" });
  });

  expect(result.current.recents).toEqual([
    { id: "164", name: "Kauppatori" },
  ]);
  expect(result.current.favoriteIds.has("164")).toBe(true);
});

test("deduplicates recents and keeps the newest stop first", () => {
  const { result } = renderHook(() => useSavedStops());

  act(() => {
    result.current.rememberRecent({ id: "164", name: "Kauppatori" });
    result.current.rememberRecent({ id: "4", name: "Turun linna" });
    result.current.rememberRecent({ id: "164", name: "Kauppatori" });
  });

  expect(result.current.recents.map((stop) => stop.id)).toEqual(["164", "4"]);
});
