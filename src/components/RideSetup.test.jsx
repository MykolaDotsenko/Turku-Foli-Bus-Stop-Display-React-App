import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchTripDetails: vi.fn(),
  fetchTripStopTimes: vi.fn(),
}));

vi.mock("../api/foliApi", () => ({
  fetchTripDetails: mocks.fetchTripDetails,
  fetchTripStopTimes: mocks.fetchTripStopTimes,
}));

import RideSetup from "./RideSetup";

test("prefers a saved Home stop and builds an exact trip/shape ride plan", async () => {
  mocks.fetchTripDetails.mockResolvedValue({
    tripId: "trip-164-1",
    routeId: "1",
    shapeId: "shape-1",
  });
  mocks.fetchTripStopTimes.mockResolvedValue([
    {
      stopId: "164",
      departureTime: "17:41:00",
      stopSequence: 1,
      dropOffType: 0,
      timepoint: 1,
      shapeDistTraveled: 0,
    },
    {
      stopId: "32",
      arrivalTime: "17:46:00",
      departureTime: "17:46:00",
      stopSequence: 2,
      dropOffType: 0,
      timepoint: 0,
      shapeDistTraveled: 900,
    },
    {
      stopId: "4",
      arrivalTime: "17:55:00",
      departureTime: "17:55:00",
      stopSequence: 3,
      dropOffType: 0,
      timepoint: 1,
      shapeDistTraveled: 1800,
    },
  ]);

  const onStart = vi.fn();
  const stopsById = new Map([
    ["164", { id: "164", name: "Kauppatori", lat: 60.45, lon: 22.26 }],
    ["32", { id: "32", name: "Puistokatu", lat: 60.44, lon: 22.25 }],
    ["4", { id: "4", name: "Turun linna", lat: 60.43, lon: 22.23 }],
  ]);
  const placesById = new Map([
    [
      "home",
      {
        id: "home",
        label: "Home",
        primaryStopId: "32",
        stops: [{ id: "32", name: "Puistokatu" }],
      },
    ],
  ]);

  render(
    <RideSetup
      arrival={{
        lineref: "1",
        tripref: "trip-164-1",
        datedvehiclejourneyref: "journey-1",
        vehicleref: "bus-1",
        destinationdisplay: "Satama",
        expecteddeparturetime: 2_000_000_000,
        originaimeddeparturetime: 1_999_999_900,
      }}
      currentStopId="164"
      currentStopName="Kauppatori"
      stopsById={stopsById}
      placesById={placesById}
      routesById={new Map([["1", { id: "1", type: 3 }]])}
      onStart={onStart}
      onCancel={() => {}}
    />
  );

  expect(
    await screen.findByRole("heading", { name: "Where do you want to get off?" })
  ).toBeInTheDocument();
  expect(screen.getByText("Home")).toBeInTheDocument();

  await waitFor(() => {
    expect(screen.getByDisplayValue("2")).toBeChecked();
  });

  fireEvent.click(
    screen.getByRole("checkbox", { name: /Follow my location/i })
  );
  fireEvent.click(screen.getByRole("button", { name: "Start Ride Mode" }));

  expect(onStart).toHaveBeenCalledTimes(1);
  const config = onStart.mock.calls[0][0];
  expect(config.targetStop.id).toBe("32");
  expect(config.previousStop.id).toBe("164");
  expect(config.nextStop.id).toBe("4");
  expect(config.options.locationBackup).toBe(false);
  expect(config.routeId).toBe("1");
  expect(config.routeType).toBe(3);
  expect(config.shapeId).toBe("shape-1");
  expect(config.targetStop.stopSequence).toBe(2);
  expect(config.targetStop.shapeDistTraveled).toBe(900);
  expect(config.plan.targetPredictedEpochSec).toBe(2_000_000_300);
});

// "route point 900 m" was shape_dist_traveled shown to a passenger. What is
// useful from a list of stop names is how far along the ride each one is.
test("describes each stop by where it falls in the ride, not by GTFS fields", async () => {
  mocks.fetchTripDetails.mockResolvedValue(null);
  mocks.fetchTripStopTimes.mockResolvedValue([
    { stopId: "164", departureTime: "17:41:00", stopSequence: 1, dropOffType: 0 },
    // The bus stops here but nobody may get off, so it is not offered as a
    // choice — yet it still counts towards "after" and "stops away".
    { stopId: "99", departureTime: "17:43:00", stopSequence: 2, dropOffType: 1 },
    { stopId: "32", departureTime: "17:46:00", stopSequence: 3, dropOffType: 0 },
  ]);

  render(
    <RideSetup
      arrival={{
        lineref: "1",
        tripref: "trip-164-1",
        expecteddeparturetime: 2_000_000_000,
      }}
      currentStopId="164"
      currentStopName="Kauppatori"
      stopsById={
        new Map([
          ["99", { id: "99", name: "Portsa" }],
          ["32", { id: "32", name: "Puistokatu" }],
        ])
      }
      placesById={new Map()}
      routesById={new Map()}
      onStart={() => {}}
      onCancel={() => {}}
    />
  );

  const option = await screen.findByText(/stops away/);
  expect(option).toHaveTextContent("2 stops away");
  expect(option).toHaveTextContent("around 17:46");
  // Counted against the real trip, so the skipped stop is still the one before.
  expect(option).toHaveTextContent("after Portsa");
  expect(screen.queryByText(/route point/i)).not.toBeInTheDocument();
});

function renderSetup(overrides = {}) {
  const stopsById = new Map([
    ["164", { id: "164", name: "Kauppatori", lat: 60.45, lon: 22.26 }],
    ["32", { id: "32", name: "Puistokatu", lat: 60.44, lon: 22.25 }],
  ]);

  render(
    <RideSetup
      arrival={{
        lineref: "1",
        tripref: "trip-164-1",
        datedvehiclejourneyref: "journey-1",
        vehicleref: "bus-1",
        destinationdisplay: "Satama",
        expecteddeparturetime: 2_000_000_000,
        originaimeddeparturetime: 1_999_999_900,
        ...overrides.arrival,
      }}
      currentStopId="164"
      currentStopName="Kauppatori"
      stopsById={stopsById}
      placesById={new Map()}
      routesById={new Map([["1", { id: "1", type: 3 }]])}
      onStart={overrides.onStart || (() => {})}
      onCancel={() => {}}
    />
  );
}

// An enabled button that does nothing when pressed is the worst possible
// failure on the action the whole feature hangs on.
test("says why the ride cannot start instead of ignoring the button", async () => {
  mocks.fetchTripDetails.mockResolvedValue(null);
  // The boarding row carries no time at all, so no plan can be anchored.
  mocks.fetchTripStopTimes.mockResolvedValue([
    { stopId: "164", stopSequence: 1, dropOffType: 0 },
    {
      stopId: "32",
      arrivalTime: "17:46:00",
      departureTime: "17:46:00",
      stopSequence: 2,
      dropOffType: 0,
    },
  ]);

  const onStart = vi.fn();
  renderSetup({ onStart });

  await screen.findByRole("button", { name: "Start Ride Mode" });
  fireEvent.click(screen.getByDisplayValue("2"));
  fireEvent.click(screen.getByRole("button", { name: "Start Ride Mode" }));

  expect(onStart).not.toHaveBeenCalled();
  expect(
    await screen.findByRole("alert")
  ).toHaveTextContent(/cannot work out a reliable plan/i);
});

test("explains a departure with no usable time", async () => {
  mocks.fetchTripDetails.mockResolvedValue(null);
  mocks.fetchTripStopTimes.mockResolvedValue([
    { stopId: "164", departureTime: "17:41:00", stopSequence: 1, dropOffType: 0 },
    {
      stopId: "32",
      arrivalTime: "17:46:00",
      departureTime: "17:46:00",
      stopSequence: 2,
      dropOffType: 0,
    },
  ]);

  const onStart = vi.fn();
  renderSetup({
    onStart,
    arrival: {
      expecteddeparturetime: null,
      aimeddeparturetime: null,
      expectedarrivaltime: null,
      aimedarrivaltime: null,
    },
  });

  await screen.findByRole("button", { name: "Start Ride Mode" });
  fireEvent.click(screen.getByDisplayValue("2"));
  fireEvent.click(screen.getByRole("button", { name: "Start Ride Mode" }));

  expect(onStart).not.toHaveBeenCalled();
  expect(await screen.findByRole("alert")).toHaveTextContent(
    /do not have a departure time/i
  );
});

test("clears a start error once another stop is chosen", async () => {
  mocks.fetchTripDetails.mockResolvedValue(null);
  mocks.fetchTripStopTimes.mockResolvedValue([
    { stopId: "164", stopSequence: 1, dropOffType: 0 },
    {
      stopId: "32",
      departureTime: "17:46:00",
      stopSequence: 2,
      dropOffType: 0,
    },
    {
      stopId: "4",
      departureTime: "17:55:00",
      stopSequence: 3,
      dropOffType: 0,
    },
  ]);

  renderSetup();

  await screen.findByRole("button", { name: "Start Ride Mode" });
  fireEvent.click(screen.getByDisplayValue("2"));
  fireEvent.click(screen.getByRole("button", { name: "Start Ride Mode" }));
  expect(await screen.findByRole("alert")).toBeInTheDocument();

  fireEvent.click(screen.getByDisplayValue("3"));
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

test("refuses to guess when the trip passes the boarding stop twice", async () => {
  mocks.fetchTripDetails.mockResolvedValue(null);
  mocks.fetchTripStopTimes.mockResolvedValue([
    { stopId: "164", departureTime: "17:41:00", stopSequence: 1, dropOffType: 0 },
    { stopId: "32", departureTime: "17:46:00", stopSequence: 2, dropOffType: 0 },
    { stopId: "164", departureTime: "17:51:00", stopSequence: 3, dropOffType: 0 },
  ]);

  renderSetup({ arrival: { aimeddeparturetime: null } });

  expect(await screen.findByRole("alert")).toHaveTextContent(
    /comes back to this stop later/i
  );
  expect(
    screen.queryByRole("button", { name: "Start Ride Mode" })
  ).not.toBeInTheDocument();
});
