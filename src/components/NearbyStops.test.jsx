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

test("requests location only after user action and selects a clear nearest stop", async () => {
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
    <NearbyStops
      stops={stops}
      coordinatesStatus="ready"
      activeStopId="4"
      onSelect={onSelect}
    />
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
    screen.getByText(/external walking route in Google Maps/i)
  ).toBeInTheDocument();

  const walkLink = screen.getByRole("link", {
    name: "Walk to Kauppatori, stop 164, in Google Maps",
  });
  expect(walkLink).toHaveAttribute("target", "_blank");
  expect(walkLink).toHaveAttribute("rel", "noreferrer");

  const url = new globalThis.URL(walkLink.href);
  expect(url.searchParams.get("destination")).toBe("60.4518,22.2666");
  expect(url.searchParams.get("travelmode")).toBe("walking");
  expect(url.searchParams.has("origin")).toBe(false);
});

test("explains denied permission without changing the active stop", async () => {
  const getCurrentPosition = vi.fn((success, error) =>
    error({ code: 1 })
  );
  const onSelect = vi.fn();

  setGeolocation(getCurrentPosition);

  render(
    <NearbyStops
      stops={stops}
      coordinatesStatus="ready"
      activeStopId="4"
      onSelect={onSelect}
    />
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
    <NearbyStops
      stops={stops}
      coordinatesStatus="ready"
      activeStopId="4"
      onSelect={onSelect}
    />
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

test("does not auto-select when two opposite-direction candidates are similarly close", async () => {
  const closeStops = [
    {
      id: "100",
      name: "Market eastbound",
      lat: 60.4519,
      lon: 22.2666,
    },
    {
      id: "101",
      name: "Market westbound",
      lat: 60.4517,
      lon: 22.2666,
    },
    { id: "4", name: "Turun linna", lat: 60.4355, lon: 22.2345 },
  ];
  const getCurrentPosition = vi.fn((success) =>
    success({
      coords: {
        latitude: 60.4518,
        longitude: 22.2666,
        accuracy: 20,
      },
    })
  );
  const onSelect = vi.fn();

  setGeolocation(getCurrentPosition);

  render(
    <NearbyStops
      stops={closeStops}
      coordinatesStatus="ready"
      activeStopId="4"
      onSelect={onSelect}
    />
  );

  fireEvent.click(
    screen.getByRole("button", { name: "Find nearest stop" })
  );

  expect(
    await screen.findByText(/Two stops are almost equally close/i)
  ).toBeInTheDocument();
  expect(onSelect).not.toHaveBeenCalled();
  expect(screen.getAllByRole("button", { name: /Market/ })).toHaveLength(2);
  expect(screen.getAllByRole("link", { name: /Walk to Market/ })).toHaveLength(
    2
  );
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
    <NearbyStops
      stops={stops}
      coordinatesStatus="ready"
      activeStopId="4"
      onSelect={onSelect}
    />
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


test("does not auto-select when the browser omits location accuracy", async () => {
  const getCurrentPosition = vi.fn((success) =>
    success({
      coords: {
        latitude: 60.45182,
        longitude: 22.26662,
      },
    })
  );
  const onSelect = vi.fn();

  setGeolocation(getCurrentPosition);

  render(
    <NearbyStops
      stops={stops}
      coordinatesStatus="ready"
      activeStopId="4"
      onSelect={onSelect}
    />
  );

  fireEvent.click(
    screen.getByRole("button", { name: "Find nearest stop" })
  );

  expect(
    await screen.findByText(/Your location is approximate/i)
  ).toBeInTheDocument();
  expect(onSelect).not.toHaveBeenCalled();
});

test("does not auto-select a clearly nearest stop when it is still too far away", async () => {
  const remoteStops = [
    { id: "100", name: "Remote one", lat: 60.47, lon: 22.2666 },
    { id: "101", name: "Remote two", lat: 60.50, lon: 22.2666 },
  ];
  const getCurrentPosition = vi.fn((success) =>
    success({
      coords: {
        latitude: 60.4518,
        longitude: 22.2666,
        accuracy: 15,
      },
    })
  );
  const onSelect = vi.fn();

  setGeolocation(getCurrentPosition);

  render(
    <NearbyStops
      stops={remoteStops}
      coordinatesStatus="ready"
      activeStopId="999"
      onSelect={onSelect}
    />
  );

  fireEvent.click(
    screen.getByRole("button", { name: "Find nearest stop" })
  );

  expect(
    await screen.findByText(/was not selected automatically/i)
  ).toBeInTheDocument();
  expect(onSelect).not.toHaveBeenCalled();
});

test("does not auto-select when the position is outside the published Föli boundary", async () => {
  const getCurrentPosition = vi.fn((success) =>
    success({
      coords: {
        latitude: 60.45182,
        longitude: 22.26662,
        accuracy: 15,
      },
    })
  );
  const onSelect = vi.fn();
  const outsideGeometry = {
    type: "MultiPolygon",
    coordinates: [
      [
        [
          [24, 61],
          [25, 61],
          [25, 62],
          [24, 62],
          [24, 61],
        ],
      ],
    ],
  };

  setGeolocation(getCurrentPosition);

  render(
    <NearbyStops
      stops={stops}
      coordinatesStatus="ready"
      activeStopId="4"
      serviceBoundary={outsideGeometry}
      onSelect={onSelect}
    />
  );

  fireEvent.click(screen.getByRole("button", { name: "Find nearest stop" }));

  expect(
    await screen.findByText(/outside Föli’s published service area/i)
  ).toBeInTheDocument();
  expect(onSelect).not.toHaveBeenCalled();
});