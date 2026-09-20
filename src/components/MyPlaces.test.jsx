import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import MyPlaces from "./MyPlaces";

const stops = [
  { id: "164", name: "Kauppatori", lat: 60.4518, lon: 22.2666 },
  { id: "32", name: "Puistokatu", lat: 60.4488, lon: 22.255 },
  { id: "4", name: "Turun linna", lat: 60.4355, lon: 22.2345 },
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

test("sets up Home from one-time location and saves only public safe stops", async () => {
  const getCurrentPosition = vi.fn((success) =>
    success({
      coords: {
        latitude: 60.45182,
        longitude: 22.26662,
        accuracy: 18,
      },
    })
  );
  const onSavePlace = vi.fn();

  setGeolocation(getCurrentPosition);

  render(
    <MyPlaces
      stops={stops}
      coordinatesStatus="ready"
      placesById={new Map()}
      onSavePlace={onSavePlace}
      onRemovePlace={vi.fn()}
      onSetPrimaryStop={vi.fn()}
      onOpenStop={vi.fn()}
    />
  );

  expect(getCurrentPosition).not.toHaveBeenCalled();

  fireEvent.click(screen.getAllByRole("button", { name: "Set up here" })[0]);

  expect(
    await screen.findByRole("heading", {
      name: "Choose safe stops for Home",
    })
  ).toBeInTheDocument();
  expect(screen.getByText(/Location accuracy ±20 m/)).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Save Home" }));

  await waitFor(() => expect(onSavePlace).toHaveBeenCalledTimes(1));

  const saved = onSavePlace.mock.calls[0][0];
  expect(saved.id).toBe("home");
  expect(saved.primaryStopId).toBe("164");
  expect(saved.stops).toEqual([
    expect.objectContaining({ id: "164", name: "Kauppatori" }),
    expect.objectContaining({ id: "32", name: "Puistokatu" }),
    expect.objectContaining({ id: "4", name: "Turun linna" }),
  ]);
  expect(saved.stops[0]).not.toHaveProperty("lat");
  expect(saved.stops[0]).not.toHaveProperty("lon");
  expect(saved.stops[0]).not.toHaveProperty("distanceMeters");
});

test("Go Home creates a transit handoff with no stored or shared origin", () => {
  render(
    <MyPlaces
      stops={stops}
      coordinatesStatus="ready"
      placesById={
        new Map([
          [
            "home",
            {
              id: "home",
              label: "Home",
              icon: "⌂",
              primaryStopId: "164",
              stops: [
                { id: "164", name: "Kauppatori" },
                { id: "32", name: "Puistokatu" },
              ],
            },
          ],
        ])
      }
      onSavePlace={vi.fn()}
      onRemovePlace={vi.fn()}
      onSetPrimaryStop={vi.fn()}
      onOpenStop={vi.fn()}
    />
  );

  const goHome = screen.getByRole("link", {
    name: "Go to Home by public transit",
  });
  const url = new globalThis.URL(goHome.href);

  expect(url.searchParams.get("destination")).toBe("60.4518,22.2666");
  expect(url.searchParams.get("travelmode")).toBe("transit");
  expect(url.searchParams.has("origin")).toBe(false);
});

test("shows a simple driver card without exposing a private address", () => {
  render(
    <MyPlaces
      stops={stops}
      coordinatesStatus="ready"
      placesById={
        new Map([
          [
            "school",
            {
              id: "school",
              label: "School",
              icon: "▣",
              primaryStopId: "32",
              stops: [{ id: "32", name: "Puistokatu" }],
            },
          ],
        ])
      }
      onSavePlace={vi.fn()}
      onRemovePlace={vi.fn()}
      onSetPrimaryStop={vi.fn()}
      onOpenStop={vi.fn()}
    />
  );

  fireEvent.click(screen.getByRole("button", { name: "Show driver" }));

  const dialog = screen.getByRole("dialog");
  expect(
    within(dialog).getByRole("heading", { name: "I need to get to School" })
  ).toBeInTheDocument();
  expect(within(dialog).getByText("Puistokatu")).toBeInTheDocument();
  expect(within(dialog).getByText("Stop 32")).toBeInTheDocument();
  expect(
    within(dialog).getByText(
      "Voitteko auttaa minua jäämään pois oikealla pysäkillä?"
    )
  ).toBeInTheDocument();
});


test("can save the already-selected public stop when location is unavailable", () => {
  const onSavePlace = vi.fn();

  render(
    <MyPlaces
      stops={stops}
      coordinatesStatus="unavailable"
      activeStopId="32"
      placesById={new Map()}
      onSavePlace={onSavePlace}
      onRemovePlace={vi.fn()}
      onSetPrimaryStop={vi.fn()}
      onOpenStop={vi.fn()}
    />
  );

  fireEvent.click(
    screen.getAllByRole("button", { name: "Save selected stop" })[0]
  );

  expect(onSavePlace).toHaveBeenCalledWith({
    id: "home",
    stops: [{ id: "32", name: "Puistokatu" }],
    primaryStopId: "32",
  });
});
