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
const originalShare = Object.getOwnPropertyDescriptor(navigator, "share");

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

  if (originalShare) {
    Object.defineProperty(navigator, "share", originalShare);
  } else {
    delete navigator.share;
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

  fireEvent.click(screen.getByRole("button", { name: "Set up Home where I am now" }));

  expect(
    await screen.findByRole("heading", {
      name: "Choose safe stops for Home",
    })
  ).toBeInTheDocument();
  expect(screen.getByText(/Location accuracy ±20 m/)).toBeInTheDocument();
  expect(
    screen.getByText(/Add backup stops only if you know they are safe/i)
  ).toBeInTheDocument();

  const safeStopChoices = screen.getAllByRole("checkbox");
  expect(safeStopChoices[0]).toBeChecked();
  expect(safeStopChoices[1]).not.toBeChecked();
  expect(safeStopChoices[2]).not.toBeChecked();

  const saveHome = screen.getByRole("button", { name: "Save Home" });
  expect(saveHome).toBeDisabled();

  fireEvent.click(
    screen.getByRole("checkbox", {
      name: /I confirm the selected stop is suitable and intended for arriving at Home/i,
    })
  );
  expect(saveHome).toBeEnabled();
  fireEvent.click(saveHome);

  await waitFor(() => expect(onSavePlace).toHaveBeenCalledTimes(1));

  const saved = onSavePlace.mock.calls[0][0];
  expect(saved.id).toBe("home");
  expect(saved.primaryStopId).toBe("164");
  expect(saved.stops).toEqual([
    expect.objectContaining({ id: "164", name: "Kauppatori" }),
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
    name: "Go Home by public transit",
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


test("reviews and confirms the selected public stop when location is unavailable", () => {
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
    screen.getByRole("button", { name: "Review selected stop for Home" })
  );

  expect(
    screen.getByRole("heading", { name: "Choose safe stops for Home" })
  ).toBeInTheDocument();
  expect(screen.getByText("Using the stop you selected manually")).toBeInTheDocument();

  const saveHome = screen.getByRole("button", { name: "Save Home" });
  expect(saveHome).toBeDisabled();

  fireEvent.click(
    screen.getByRole("checkbox", {
      name: /I confirm the selected stop is suitable and intended for arriving at Home/i,
    })
  );
  fireEvent.click(saveHome);

  expect(onSavePlace).toHaveBeenCalledWith({
    id: "home",
    stops: [{ id: "32", name: "Puistokatu" }],
    primaryStopId: "32",
  });
});


test("requires explicit confirmation before importing a shared Home", () => {
  const onImportSharedPlace = vi.fn();
  const onDismissSharedPlace = vi.fn();

  render(
    <MyPlaces
      stops={stops}
      coordinatesStatus="ready"
      activeStopId="164"
      placesById={new Map()}
      sharedPlace={{
        id: "home",
        primaryStopId: "164",
        stops: [
          { id: "164", name: "Kauppatori" },
          { id: "32", name: "Puistokatu" },
        ],
      }}
      onSavePlace={vi.fn()}
      onImportSharedPlace={onImportSharedPlace}
      onDismissSharedPlace={onDismissSharedPlace}
      onRemovePlace={vi.fn()}
      onSetPrimaryStop={vi.fn()}
      onOpenStop={vi.fn()}
    />
  );

  expect(
    screen.getByRole("heading", { name: "Add Home?" })
  ).toBeInTheDocument();
  expect(
    screen.getByText(/can still reveal the general area/i)
  ).toBeInTheDocument();
  expect(onImportSharedPlace).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: "Add Home" }));
  expect(onImportSharedPlace).toHaveBeenCalledTimes(1);
});

test("labels a shared place as replacement when that preset already exists", () => {
  render(
    <MyPlaces
      stops={stops}
      coordinatesStatus="ready"
      activeStopId="164"
      placesById={
        new Map([
          [
            "home",
            {
              id: "home",
              label: "Home",
              icon: "⌂",
              primaryStopId: "32",
              stops: [{ id: "32", name: "Puistokatu" }],
            },
          ],
        ])
      }
      sharedPlace={{
        id: "home",
        primaryStopId: "164",
        stops: [{ id: "164", name: "Kauppatori" }],
      }}
      onSavePlace={vi.fn()}
      onImportSharedPlace={vi.fn()}
      onDismissSharedPlace={vi.fn()}
      onRemovePlace={vi.fn()}
      onSetPrimaryStop={vi.fn()}
      onOpenStop={vi.fn()}
    />
  );

  expect(
    screen.getByRole("heading", { name: "Replace Home?" })
  ).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Replace Home" })
  ).toBeInTheDocument();
});

test("shares a configured place through the native share sheet when available", async () => {
  const share = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "share", {
    configurable: true,
    value: share,
  });

  render(
    <MyPlaces
      stops={stops}
      coordinatesStatus="ready"
      activeStopId="164"
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
      sharedPlace={null}
      onSavePlace={vi.fn()}
      onImportSharedPlace={vi.fn()}
      onDismissSharedPlace={vi.fn()}
      onRemovePlace={vi.fn()}
      onSetPrimaryStop={vi.fn()}
      onOpenStop={vi.fn()}
    />
  );

  fireEvent.click(screen.getByText("Manage Home"));
  fireEvent.click(screen.getByRole("button", { name: "Share Home" }));

  await waitFor(() => expect(share).toHaveBeenCalledTimes(1));

  const shareData = share.mock.calls[0][0];
  const url = new globalThis.URL(shareData.url);

  expect(url.search).toBe("");
  expect(url.hash).toMatch(/^#place=/);
  expect(shareData.text).toBe("Add Home to My Places");
});


test("adds backup Safe Arrival stops only after explicit opt-in", async () => {
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

  fireEvent.click(
    screen.getByRole("button", { name: "Set up Home where I am now" })
  );

  await screen.findByRole("heading", {
    name: "Choose safe stops for Home",
  });

  const choices = screen.getAllByRole("checkbox");
  const saveHome = screen.getByRole("button", { name: "Save Home" });

  fireEvent.click(
    screen.getByRole("checkbox", {
      name: /I confirm the selected stop is suitable and intended for arriving at Home/i,
    })
  );
  expect(saveHome).toBeEnabled();

  fireEvent.click(choices[1]);
  expect(saveHome).toBeDisabled();

  fireEvent.click(
    screen.getByRole("checkbox", {
      name: /I confirm the selected stops are suitable and intended for arriving at Home/i,
    })
  );
  fireEvent.click(saveHome);

  await waitFor(() => expect(onSavePlace).toHaveBeenCalledTimes(1));
  expect(onSavePlace.mock.calls[0][0].stops).toEqual([
    { id: "164", name: "Kauppatori" },
    { id: "32", name: "Puistokatu" },
  ]);
});


test("warns that sharing a Safe Place can reveal its general area", () => {
  render(
    <MyPlaces
      stops={stops}
      coordinatesStatus="ready"
      activeStopId="164"
      placesById={
        new Map([
          [
            "home",
            {
              id: "home",
              label: "Home",
              icon: "⌂",
              primaryStopId: "164",
              stops: [{ id: "164", name: "Kauppatori" }],
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

  fireEvent.click(screen.getByText("Manage Home"));
  expect(
    screen.getByText(/Sharing Home reveals its saved public stop names and IDs/i)
  ).toBeInTheDocument();
});


test("does not preselect a Safe Place when location accuracy is poor", async () => {
  const getCurrentPosition = vi.fn((success) =>
    success({
      coords: {
        latitude: 60.45182,
        longitude: 22.26662,
        accuracy: 2_500,
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

  fireEvent.click(
    screen.getByRole("button", { name: "Set up Home where I am now" })
  );

  await screen.findByRole("heading", {
    name: "Choose safe stops for Home",
  });

  expect(
    screen.getByText(/no stop was preselected/i)
  ).toBeInTheDocument();

  const stopChoices = screen
    .getAllByRole("checkbox")
    .filter((element) => !/I confirm/.test(element.getAttribute("aria-label") || ""));

  expect(stopChoices[0]).not.toBeChecked();
  expect(stopChoices[1]).not.toBeChecked();
  expect(stopChoices[2]).not.toBeChecked();
  expect(screen.getByRole("button", { name: "Save Home" })).toBeDisabled();
  expect(onSavePlace).not.toHaveBeenCalled();
});