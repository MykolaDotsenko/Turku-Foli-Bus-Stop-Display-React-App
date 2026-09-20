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
