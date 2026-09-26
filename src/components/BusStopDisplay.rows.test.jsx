import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchTripStopTimes: vi.fn(() =>
    Promise.resolve([
      { stopId: "164", stopSequence: 1, arrivalTime: "12:00:00", departureTime: "12:00:00", dropOffType: 0 },
      { stopId: "32", stopSequence: 2, arrivalTime: "12:05:00", departureTime: "12:05:00", dropOffType: 0 },
      { stopId: "4", stopSequence: 3, arrivalTime: "12:10:00", departureTime: "12:10:00", dropOffType: 0 },
    ])
  ),
  fetchTripDetails: vi.fn(() => Promise.resolve(null)),
}));

vi.mock("../api/foliApi", () => ({
  fetchTripStopTimes: mocks.fetchTripStopTimes,
  fetchTripDetails: mocks.fetchTripDetails,
}));

import BusStopDisplay from "./BusStopDisplay";

const NOW = Math.floor(Date.now() / 1000);

function departure(overrides = {}) {
  return {
    lineref: "1",
    destinationdisplay: "Satama",
    tripref: "trip-1",
    monitored: true,
    recordedattime: NOW - 5,
    aimeddeparturetime: NOW + 300,
    expecteddeparturetime: NOW + 300,
    ...overrides,
  };
}

function board(arrivals) {
  return (
    <BusStopDisplay
      stopId="164"
      stopName="Kauppatori"
      stop={{ id: "164", name: "Kauppatori" }}
      stops={[
        { id: "164", name: "Kauppatori" },
        { id: "32", name: "Puistokatu" },
        { id: "4", name: "Turun linna" },
      ]}
      arrivals={arrivals}
      routesById={new Map()}
      routesByShortName={new Map()}
      serverTime={NOW}
      receivedAtMs={Date.now()}
      loading={false}
      refreshing={false}
      error={false}
      onRefresh={() => {}}
      placesById={new Map()}
      onStartRide={() => {}}
    />
  );
}

function setupPanels() {
  return screen.queryAllByRole("region", { name: "Set up get-off alerts" });
}

async function openSetupAndChooseTurunLinna(buttonIndex = 0) {
  fireEvent.click(
    screen.getAllByRole("button", { name: "Alert me when to get off" })[
      buttonIndex
    ]
  );
  await screen.findByText("Turun linna");
  const choice = document.querySelector('input[type="radio"][value="3"]');
  fireEvent.click(choice);
  expect(choice).toBeChecked();
}

afterEach(() => {
  vi.restoreAllMocks();
});

// The board refreshes every 30 seconds and a live estimate moves on nearly
// every one. Keying the row on that estimate remounted it, so the get-off
// setup closed mid-choice and took the chosen stop with it.
test("an open get-off setup survives a routine live-estimate update", async () => {
  const { rerender } = render(board([departure()]));
  await openSetupAndChooseTurunLinna();

  rerender(board([departure({ expecteddeparturetime: NOW + 320 })]));

  expect(setupPanels()).toHaveLength(1);
  expect(
    document.querySelector('input[type="radio"][value="3"]')
  ).toBeChecked();
});

test("an open get-off setup survives an earlier bus leaving the board", async () => {
  const earlier = departure({
    lineref: "7",
    tripref: "trip-0",
    aimeddeparturetime: NOW + 60,
    expecteddeparturetime: NOW + 60,
  });
  const { rerender } = render(board([earlier, departure()]));
  await openSetupAndChooseTurunLinna(1);

  rerender(board([departure()]));

  expect(setupPanels()).toHaveLength(1);
  expect(
    document.querySelector('input[type="radio"][value="3"]')
  ).toBeChecked();
});

test("an expanded next-stops list stays open across a refresh", async () => {
  const { rerender } = render(board([departure()]));
  fireEvent.click(screen.getByRole("button", { name: "Next stops" }));
  await screen.findByText("Planned stop sequence");

  rerender(board([departure({ expecteddeparturetime: NOW + 320 })]));

  expect(
    screen.getByRole("button", { name: "Hide next stops" })
  ).toBeInTheDocument();
});

test("two visits of one looping trip keep separate rows and panels", async () => {
  const consoleError = vi.spyOn(console, "error");
  render(
    board([
      departure(),
      departure({
        aimeddeparturetime: NOW + 1_500,
        expecteddeparturetime: NOW + 1_500,
      }),
    ])
  );

  fireEvent.click(
    screen.getAllByRole("button", { name: "Alert me when to get off" })[0]
  );

  expect(setupPanels()).toHaveLength(1);
  expect(
    screen.getAllByRole("button", { name: "Alert me when to get off" })
  ).toHaveLength(1);
  expect(
    consoleError.mock.calls.some((call) =>
      String(call[0]).includes("same key")
    )
  ).toBe(false);
});

test("a different departure taking the slot does not inherit an open setup", async () => {
  const { rerender } = render(board([departure()]));
  fireEvent.click(
    screen.getByRole("button", { name: "Alert me when to get off" })
  );
  expect(setupPanels()).toHaveLength(1);

  rerender(board([departure({ tripref: "trip-2" })]));

  expect(setupPanels()).toHaveLength(0);
});
