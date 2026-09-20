import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import BusStopDisplay from "./BusStopDisplay";

test("uses official route identity while preserving readable contrast and live proximity", () => {
  const now = Math.floor(Date.now() / 1000);
  const routesByShortName = new Map([
    [
      "1",
      {
        id: "1",
        shortName: "1",
        longName: "Satama–Kauppatori–Lentoasema",
        type: 3,
        color: "#ffff00",
        textColor: "#ffffff",
      },
    ],
  ]);

  render(
    <BusStopDisplay
      stopId="164"
      stopName="Kauppatori"
      stop={{ id: "164", name: "Kauppatori", lat: 60.4518, lon: 22.2666 }}
      routesByShortName={routesByShortName}
      serverTime={now}
      loading={false}
      refreshing={false}
      error={false}
      onRefresh={() => {}}
      arrivals={[
        {
          lineref: "1",
          destinationdisplay: "Satama",
          monitored: true,
          latitude: 60.4538,
          longitude: 22.2666,
          recordedattime: now - 10,
          expecteddeparturetime: now + 180,
          aimeddeparturetime: now + 160,
        },
      ]}
    />
  );

  const lineBadge = screen.getByTitle("Satama–Kauppatori–Lentoasema");
  expect(lineBadge).toHaveAttribute(
    "title",
    "Satama–Kauppatori–Lentoasema"
  );
  expect(lineBadge).toHaveStyle({
    backgroundColor: "#ffff00",
    color: "#000000",
  });
  expect(screen.getByText(/Bus approaching/i)).toBeInTheDocument();
});


test("does not present an old vehicle position as current proximity", () => {
  const now = Math.floor(Date.now() / 1000);

  render(
    <BusStopDisplay
      stopId="164"
      stopName="Kauppatori"
      stop={{ id: "164", name: "Kauppatori", lat: 60.4518, lon: 22.2666 }}
      routesByShortName={new Map()}
      serverTime={now}
      loading={false}
      refreshing={false}
      error={false}
      onRefresh={() => {}}
      arrivals={[
        {
          lineref: "1",
          destinationdisplay: "Satama",
          monitored: true,
          latitude: 60.4538,
          longitude: 22.2666,
          recordedattime: now - 200,
          expecteddeparturetime: now + 180,
          aimeddeparturetime: now + 160,
        },
      ]}
    />
  );

  expect(screen.getByText(/Last bus position/i)).toHaveTextContent("3 min old");
  expect(screen.queryByText(/Bus approaching/i)).not.toBeInTheDocument();
});
