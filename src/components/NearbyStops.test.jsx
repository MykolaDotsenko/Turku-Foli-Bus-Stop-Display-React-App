import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import NearbyStops from "./NearbyStops";

const stops = [
  { id: "164", name: "Kauppatori", lat: 60.4518, lon: 22.2666 },
  { id: "4", name: "Turun linna", lat: 60.4355, lon: 22.2345 },
  { id: "32", name: "Puistokatu", lat: 60.4488, lon: 22.255 },
];

afterEach(() => {
  vi.restoreAllMocks();
});

test("requests location only after user action and selects the nearest stop", async () => {
  const getCurrentPosition = vi.fn((success) =>
    success({
      coords: {
        latitude: 60.45182,
        longitude: 22.26662,
        accuracy: 18,
      },
    })
  );
  const onSelect = vi.fn();

  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: { getCurrentPosition },
  });

  render(
    <NearbyStops stops={stops} activeStopId="4" onSelect={onSelect} />
  );

  expect(getCurrentPosition).not.toHaveBeenCalled();

  fireEvent.click(
    screen.getByRole("button", { name: "Find nearest stop" })
  );

  await waitFor(() => expect(onSelect).toHaveBeenCalledWith("164"));
  expect(getCurrentPosition).toHaveBeenCalledTimes(1);
  expect(screen.getByText("Nearest")).toBeInTheDocument();
  expect(screen.getByText(/Accuracy ±20 m/)).toBeInTheDocument();
  expect(
    screen.getByText(/straight-line distances, not walking-route distances/i)
  ).toBeInTheDocument();
});

test("explains denied permission without changing the active stop", async () => {
  const getCurrentPosition = vi.fn((success, error) =>
    error({ code: 1 })
  );
  const onSelect = vi.fn();

  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: { getCurrentPosition },
  });

  render(
    <NearbyStops stops={stops} activeStopId="4" onSelect={onSelect} />
  );

  fireEvent.click(
    screen.getByRole("button", { name: "Find nearest stop" })
  );

  expect(
    await screen.findByText(/Location access is blocked/i)
  ).toBeInTheDocument();
  expect(onSelect).not.toHaveBeenCalled();
});
