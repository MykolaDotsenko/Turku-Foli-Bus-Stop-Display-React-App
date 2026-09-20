import { act, renderHook } from "@testing-library/react";
import { beforeEach, expect, test } from "vitest";
import useSavedPlaces from "./useSavedPlaces";

beforeEach(() => {
  localStorage.clear();
});

test("stores only public safe-stop identity and never private setup coordinates", () => {
  const { result } = renderHook(() => useSavedPlaces());

  act(() => {
    result.current.savePlace({
      id: "home",
      primaryStopId: "164",
      stops: [
        {
          id: "164",
          name: "Kauppatori",
          lat: 60.4518,
          lon: 22.2666,
          distanceMeters: 18,
        },
        {
          id: "32",
          name: "Puistokatu",
          lat: 60.4488,
          lon: 22.255,
        },
      ],
    });
  });

  expect(result.current.byId.get("home")).toEqual(
    expect.objectContaining({
      id: "home",
      label: "Home",
      primaryStopId: "164",
      stops: [
        { id: "164", name: "Kauppatori" },
        { id: "32", name: "Puistokatu" },
      ],
    })
  );

  const stored = localStorage.getItem("foli-my-places-v1");
  expect(stored).not.toContain("60.4518");
  expect(stored).not.toContain("22.2666");
  expect(stored).not.toContain("distanceMeters");
  expect(stored).not.toContain("address");
});

test("can change the primary safe stop and remove a place", () => {
  const { result } = renderHook(() => useSavedPlaces());

  act(() => {
    result.current.savePlace({
      id: "school",
      primaryStopId: "100",
      stops: [
        { id: "100", name: "School east" },
        { id: "101", name: "School west" },
      ],
    });
  });

  act(() => {
    result.current.setPrimaryStop("school", "101");
  });

  expect(result.current.byId.get("school").primaryStopId).toBe("101");

  act(() => {
    result.current.removePlace("school");
  });

  expect(result.current.byId.has("school")).toBe(false);
});


test("revalidates saved stops against a fresh public catalogue without storing coordinates", () => {
  const { result } = renderHook(() => useSavedPlaces());

  act(() => {
    result.current.savePlace({
      id: "home",
      primaryStopId: "164",
      stops: [
        { id: "164", name: "Old market name" },
        { id: "999", name: "Removed stop" },
      ],
    });
  });

  act(() => {
    result.current.revalidatePlaces(
      [
        { id: "164", name: "Kauppatori", lat: 60.4518, lon: 22.2666 },
        { id: "32", name: "Puistokatu", lat: 60.4488, lon: 22.255 },
      ],
      1_700_000_000_000
    );
  });

  const home = result.current.byId.get("home");
  expect(home.stops[0]).toEqual({ id: "164", name: "Kauppatori" });
  expect(home.stops[1]).toEqual({ id: "999", name: "Removed stop" });
  expect(home.needsReview).toBe(true);
  expect(home.validatedAt).toBeGreaterThan(0);

  const stored = localStorage.getItem("foli-my-places-v1");
  expect(stored).not.toContain("60.4518");
  expect(stored).not.toContain("22.2666");
});

test("clears Safe Place review state once every saved stop exists again", () => {
  const { result } = renderHook(() => useSavedPlaces());

  act(() => {
    result.current.savePlace({
      id: "work",
      primaryStopId: "100",
      stops: [{ id: "100", name: "Work stop" }],
    });
    result.current.revalidatePlaces(
      [{ id: "101", name: "Other stop" }],
      1_700_000_000_000
    );
  });

  expect(result.current.byId.get("work").needsReview).toBe(true);

  act(() => {
    result.current.revalidatePlaces(
      [{ id: "100", name: "Work stop renamed" }],
      1_700_000_100_000
    );
  });

  expect(result.current.byId.get("work").needsReview).toBe(false);
  expect(result.current.byId.get("work").stops[0].name).toBe("Work stop renamed");
});


test("validates a place saved after the catalogue was already loaded", () => {
  const { result } = renderHook(() => useSavedPlaces());

  act(() => {
    result.current.savePlace({
      id: "home",
      primaryStopId: "999",
      stops: [{ id: "999", name: "Shared old stop" }],
    });
  });

  expect(result.current.byId.get("home").validatedAt).toBe(0);

  act(() => {
    result.current.revalidatePlaces(
      [{ id: "164", name: "Kauppatori" }],
      1_700_000_000_000
    );
  });

  expect(result.current.byId.get("home")).toEqual(
    expect.objectContaining({
      needsReview: true,
      validatedAt: 1_700_000_000_000,
    })
  );
});
