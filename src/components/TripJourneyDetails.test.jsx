import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchTripStopTimes: vi.fn(),
}));

vi.mock("../api/foliApi", () => ({
  fetchTripStopTimes: mocks.fetchTripStopTimes,
}));

import TripJourneyDetails from "./TripJourneyDetails";

test("loads the planned sequence only after the user opens Next stops", async () => {
  mocks.fetchTripStopTimes.mockResolvedValue([
    {
      stopId: "164",
      arrivalTime: "17:40:00",
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
      arrivalTime: "25:05:00",
      departureTime: "25:05:00",
      stopSequence: 3,
      dropOffType: 0,
      timepoint: 1,
    },
  ]);

  render(
    <TripJourneyDetails
      tripId="trip-1"
      currentStopId="164"
      stopsById={
        new Map([
          ["164", { id: "164", name: "Kauppatori" }],
          ["32", { id: "32", name: "Puistokatu" }],
          ["4", { id: "4", name: "Turun linna" }],
        ])
      }
    />
  );

  expect(mocks.fetchTripStopTimes).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: "Next stops" }));

  expect(
    await screen.findByText("Planned stop sequence")
  ).toBeInTheDocument();
  expect(mocks.fetchTripStopTimes).toHaveBeenCalledTimes(1);
  expect(screen.getByText("Puistokatu")).toBeInTheDocument();
  expect(screen.getByText("around 17:46")).toBeInTheDocument();
  expect(screen.getByText("Turun linna")).toBeInTheDocument();
  expect(screen.getByText("01:05")).toBeInTheDocument();
  expect(screen.queryByText("Kauppatori")).not.toBeInTheDocument();
});
