import { render, screen } from "@testing-library/react";
import BusStopDisplay from "./components/BusStopDisplay";
import { formatDelay, formatDue } from "./utils/time";

test("formats Föli delay values as seconds, not minutes", () => {
  expect(formatDelay(125)).toBe("+2 min");
  expect(formatDelay(-61)).toBe("1 min early");
  expect(formatDelay(15)).toBe("On time");
});

test("formats a near departure as due", () => {
  const now = 1_700_000_000_000;
  expect(formatDue(now / 1000 + 40, now)).toBe("Due");
});

test("renders a real-time departure row", () => {
  render(
    <BusStopDisplay
      stopId="164"
      stopName="Kauppatori"
      serverTime={1700000000}
      loading={false}
      refreshing={false}
      error=""
      onRefresh={() => {}}
      arrivals={[
        {
          lineref: "1",
          destinationdisplay: "Satama",
          expectedarrivaltime: 1700000300,
          monitored: true,
          delay: 60,
        },
      ]}
    />
  );

  expect(screen.getByText("Kauppatori")).toBeInTheDocument();
  expect(screen.getByText("Satama")).toBeInTheDocument();
  expect(screen.getByText("Real-time")).toBeInTheDocument();
  expect(screen.getByText("+1 min")).toBeInTheDocument();
});
