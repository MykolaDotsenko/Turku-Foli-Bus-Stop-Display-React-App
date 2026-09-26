import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import BusStopDisplay from "./BusStopDisplay";

const NOW = Math.floor(Date.now() / 1000);

function departure(line, destination, inSeconds) {
  return {
    lineref: line,
    destinationdisplay: destination,
    monitored: false,
    aimeddeparturetime: NOW + inSeconds,
  };
}

// A busy stop: the 32 is the one this commuter takes, and its second bus
// sits below the first ten rows of everything else.
const busyStop = [
  departure("1", "Satama", 60),
  departure("32", "Varissuo", 120),
  ...Array.from({ length: 10 }, (_, index) =>
    departure(index % 2 ? "7" : "1", index % 2 ? "Runosmäki" : "Satama", 180 + index * 60)
  ),
  departure("32", "Varissuo", 1_200),
];

function board(props = {}) {
  return (
    <BusStopDisplay
      stopId="164"
      stopName="Kauppatori"
      arrivals={busyStop}
      routesById={new Map()}
      routesByShortName={new Map()}
      serverTime={NOW}
      receivedAtMs={Date.now()}
      scheduleAvailable
      loading={false}
      refreshing={false}
      error={false}
      onRefresh={() => {}}
      {...props}
    />
  );
}

const rows = () => screen.getAllByRole("row").slice(1);

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

test("following one line shows only its buses, later ones included", () => {
  render(board());
  expect(rows()).toHaveLength(10);

  fireEvent.click(screen.getByRole("button", { name: "Filter lines" }));
  const filter = screen.getByRole("group", { name: "Show only these lines" });
  fireEvent.click(within(filter).getByRole("button", { name: "Line 32" }));

  expect(rows()).toHaveLength(2);
  expect(screen.getAllByText("Varissuo")).toHaveLength(2);
  expect(screen.queryByText("Satama")).not.toBeInTheDocument();
  expect(within(filter).getByRole("button", { name: "Line 32" })).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  expect(screen.getByRole("button", { name: "Only line 32" })).toBeInTheDocument();
});

test("several lines can be followed, and All lines clears them", () => {
  render(board());
  fireEvent.click(screen.getByRole("button", { name: "Filter lines" }));
  const filter = screen.getByRole("group", { name: "Show only these lines" });
  fireEvent.click(within(filter).getByRole("button", { name: "Line 32" }));
  fireEvent.click(within(filter).getByRole("button", { name: "Line 7" }));

  expect(screen.getByRole("button", { name: "Only lines 32, 7" })).toBeInTheDocument();
  expect(screen.queryByText("Satama")).not.toBeInTheDocument();

  fireEvent.click(within(filter).getByRole("button", { name: "All lines" }));
  expect(rows()).toHaveLength(10);
  expect(screen.getByRole("button", { name: "Filter lines" })).toBeInTheDocument();
});

test("a stop keeps its own filter, and another stop does not inherit it", () => {
  const { unmount } = render(board());
  fireEvent.click(screen.getByRole("button", { name: "Filter lines" }));
  fireEvent.click(screen.getByRole("button", { name: "Line 32" }));
  unmount();

  const { rerender } = render(board());
  expect(rows()).toHaveLength(2);

  rerender(board({ stopId: "32", stopName: "Puistokatu" }));
  expect(rows()).toHaveLength(10);
  expect(screen.getByRole("button", { name: "Filter lines" })).toBeInTheDocument();
});

test("a followed line with nothing coming says so, not that the stop is empty", () => {
  const onRefresh = vi.fn();
  localStorage.setItem(
    "foli-line-filter-v1",
    JSON.stringify({ 164: { lines: ["99"], savedAt: Date.now() } })
  );
  render(board({ onRefresh }));

  expect(screen.getByText("No departures on line 99 right now.")).toBeInTheDocument();
  expect(screen.queryByText("No upcoming departures.")).not.toBeInTheDocument();
  expect(screen.queryByText("Checking for the next departures…")).not.toBeInTheDocument();
  expect(onRefresh).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: "Show all lines" }));
  expect(rows()).toHaveLength(10);
});

test("a stop served by one line offers no filter", () => {
  render(board({ arrivals: [departure("32", "Varissuo", 120), departure("32", "Varissuo", 900)] }));

  expect(screen.queryByRole("button", { name: "Filter lines" })).not.toBeInTheDocument();
});

test("a stored filter that is not a filter is ignored", () => {
  localStorage.setItem("foli-line-filter-v1", JSON.stringify({ 164: { lines: "32" } }));
  render(board());

  expect(rows()).toHaveLength(10);
});
