import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchTripStopTimes: vi.fn(),
}));

vi.mock("../api/foliApi", () => ({
  fetchTripStopTimes: mocks.fetchTripStopTimes,
}));

import RideSetup from "./RideSetup";

test("prefers a saved Home stop and builds an explicit ride plan", async () => {
  mocks.fetchTripStopTimes.mockResolvedValue([
    {
      stopId: "164",
      departureTime: "17:41:00",
      stopSequence: 1,
      dropOffType: 0,
      timepoint: 1,
    },
    {
      stopId: "32",
      arrivalTime: "17:46:00",
      departureTime: "17:46:00",
      stopSequence: 2,
      dropOffType: 0,
      timepoint: 0,
    },
    {
      stopId: "4",
      arrivalTime: "17:55:00",
      departureTime: "17:55:00",
      stopSequence: 3,
      dropOffType: 0,
      timepoint: 1,
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
      onStart={onStart}
      onCancel={() => {}}
    />
  );

  expect(
    await screen.findByRole("heading", { name: "Where do you want to get off?" })
  ).toBeInTheDocument();
  expect(screen.getByText("Home")).toBeInTheDocument();

  await waitFor(() => {
    expect(screen.getByDisplayValue("32")).toBeChecked();
  });

  fireEvent.click(
    screen.getByRole("checkbox", { name: /Use location as a backup/i })
  );
  fireEvent.click(screen.getByRole("button", { name: "Start Ride Mode" }));

  expect(onStart).toHaveBeenCalledTimes(1);
  const config = onStart.mock.calls[0][0];
  expect(config.targetStop.id).toBe("32");
  expect(config.previousStop.id).toBe("164");
  expect(config.nextStop.id).toBe("4");
  expect(config.options.locationBackup).toBe(false);
  expect(config.plan.targetPredictedEpochSec).toBe(2_000_000_300);
});
