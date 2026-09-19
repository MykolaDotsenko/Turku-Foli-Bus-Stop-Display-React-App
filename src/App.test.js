import { render, screen } from "@testing-library/react";
import BusStopDisplay from "./components/BusStopDisplay";
import {
  formatClock,
  formatDelay,
  formatDue,
  formatServiceStatus,
  getDepartureTime,
} from "./utils/time";

test("uses departure time before arrival time", () => {
  expect(
    getDepartureTime({
      expecteddeparturetime: 200,
      expectedarrivaltime: 100,
      aimeddeparturetime: 300,
    })
  ).toBe(200);
});

test("falls back through the documented Föli time fields", () => {
  expect(getDepartureTime({ aimeddeparturetime: 300 })).toBe(300);
  expect(getDepartureTime({ aimedarrivaltime: 400 })).toBe(400);
  expect(getDepartureTime({})).toBeNull();
});

test("formats Föli delay values as seconds", () => {
  expect(formatDelay(125)).toBe("+2 min");
  expect(formatDelay(-61)).toBe("1 min early");
  expect(formatDelay(15)).toBe("on time");
});

test("never calls a scheduled vehicle on time", () => {
  expect(formatServiceStatus(false, 0)).toBe("Scheduled");
  expect(formatServiceStatus(true, 0)).toBe("Live · on time");
  expect(formatServiceStatus(true, undefined)).toBe("Live");
});

test("shows due only inside the final minute", () => {
  const now = 1_700_000_000_000;

  expect(formatDue(now / 1000 + 60, now)).toBe("Due");
  expect(formatDue(now / 1000 + 61, now)).toBe("2 min");
});

test("renders departure time and compact trip status", () => {
  const departureTime = 1_900_000_600;
  const arrivalTime = 1_900_000_300;

  render(
    <BusStopDisplay
      stopId="164"
      stopName="Kauppatori"
      serverTime={1_900_000_000}
      loading={false}
      refreshing={false}
      error={false}
      onRefresh={() => {}}
      arrivals={[
        {
          lineref: "1",
          destinationdisplay: "Satama",
          expectedarrivaltime: arrivalTime,
          expecteddeparturetime: departureTime,
          monitored: true,
          delay: 60,
        },
      ]}
    />
  );

  expect(screen.getByText("Kauppatori")).toBeInTheDocument();
  expect(screen.getByText("Satama")).toBeInTheDocument();
  expect(
    screen.getByText((text) =>
      text.includes(`Live · +1 min · ${formatClock(departureTime)}`)
    )
  ).toBeInTheDocument();
});

test("shows a useful failure state when no stop data exists", () => {
  render(
    <BusStopDisplay
      stopId="99999"
      stopName=""
      serverTime={null}
      loading={false}
      refreshing={false}
      error={true}
      onRefresh={() => {}}
      arrivals={[]}
    />
  );

  expect(screen.getByText("Couldn’t load departures.")).toBeInTheDocument();
  expect(
    screen.getByText("Check the stop number and try again.")
  ).toBeInTheDocument();
});
