import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import NearbyStops from "./NearbyStops";

const stops = [
  { id: "164", name: "Kauppatori", lat: 60.4518, lon: 22.2666 },
  { id: "4", name: "Turun linna", lat: 60.4355, lon: 22.2345 },
  { id: "32", name: "Puistokatu", lat: 60.4488, lon: 22.255 },
];

const originalGeolocation = Object.getOwnPropertyDescriptor(
  navigator,
  "geolocation"
);

function setGeolocation(getCurrentPosition) {
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: { getCurrentPosition },
  });
}

afterEach(() => {
  vi.restoreAllMocks();

  if (originalGeolocation) {
    Object.defineProperty(navigator, "geolocation", originalGeolocation);
  } else {
    delete navigator.geolocation;
  }
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

  setGeolocation(getCurrentPosition);

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

  setGeolocation(getCurrentPosition);

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

test("does not auto-select when reported location accuracy is poor", async () => {
  const getCurrentPosition = vi.fn((success) =>
    success({
      coords: {
        latitude: 60.45182,
        longitude: 22.26662,
        accuracy: 2_500,
      },
    })
  );
  const onSelect = vi.fn();

  setGeolocation(getCurrentPosition);

  render(
    <NearbyStops stops={stops} activeStopId="4" onSelect={onSelect} />
  );

  fireEvent.click(
    screen.getByRole("button", { name: "Find nearest stop" })
  );

  expect(
    await screen.findByText(/Your location is approximate/i)
  ).toBeInTheDocument();
  expect(onSelect).not.toHaveBeenCalled();
  expect(screen.getByText("Nearest")).toBeInTheDocument();
});

test("retries a timed-out high-accuracy request with fallback options", async () => {
  const getCurrentPosition = vi
    .fn()
    .mockImplementationOnce((success, error) => error({ code: 3 }))
    .mockImplementationOnce((success) =>
      success({
        coords: {
          latitude: 60.45182,
          longitude: 22.26662,
          accuracy: 120,
        },
      })
    );
  const onSelect = vi.fn();

  setGeolocation(getCurrentPosition);

  render(
    <NearbyStops stops={stops} activeStopId="4" onSelect={onSelect} />
  );

  fireEvent.click(
    screen.getByRole("button", { name: "Find nearest stop" })
  );

  await waitFor(() => expect(onSelect).toHaveBeenCalledWith("164"));
  expect(getCurrentPosition).toHaveBeenCalledTimes(2);
  expect(getCurrentPosition.mock.calls[0][2]).toMatchObject({
    enableHighAccuracy: true,
    timeout: 8_000,
  });
  expect(getCurrentPosition.mock.calls[1][2]).toMatchObject({
    enableHighAccuracy: false,
    timeout: 5_000,
  });
});
