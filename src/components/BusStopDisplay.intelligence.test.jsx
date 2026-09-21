import { act, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import BusStopDisplay from "./BusStopDisplay";

afterEach(() => {
  vi.useRealTimers();
});

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
  expect(screen.getByText(/Bus nearby/i)).toBeInTheDocument();
});


test("does not present an old vehicle position as current nearby status", () => {
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
  expect(screen.queryByText(/Bus nearby/i)).not.toBeInTheDocument();
});


test("drops already-departed and untimed rows instead of presenting them as Due", () => {
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
          lineref: "OLD",
          destinationdisplay: "Already gone",
          monitored: false,
          aimeddeparturetime: now - 180,
        },
        {
          lineref: "NONE",
          destinationdisplay: "Missing time",
          monitored: false,
        },
        {
          lineref: "NEXT",
          destinationdisplay: "Still useful",
          monitored: false,
          aimeddeparturetime: now + 300,
        },
      ]}
    />
  );

  expect(screen.queryByText("Already gone")).not.toBeInTheDocument();
  expect(screen.queryByText("Missing time")).not.toBeInTheDocument();
  expect(screen.getByText("Still useful")).toBeInTheDocument();
});


test("keeps aging a last successful payload while refreshes fail", () => {
  const nowMs = Date.now();
  const nowSeconds = Math.floor(nowMs / 1000);
  const serverTime = nowSeconds - 180;

  render(
    <BusStopDisplay
      stopId="164"
      stopName="Kauppatori"
      stop={{ id: "164", name: "Kauppatori", lat: 60.4518, lon: 22.2666 }}
      routesByShortName={new Map()}
      serverTime={serverTime}
      receivedAtMs={nowMs - 180_000}
      loading={false}
      refreshing={false}
      error
      onRefresh={() => {}}
      arrivals={[
        {
          lineref: "1",
          destinationdisplay: "Satama",
          monitored: true,
          latitude: 60.4538,
          longitude: 22.2666,
          recordedattime: serverTime - 10,
          expecteddeparturetime: nowSeconds + 300,
          aimeddeparturetime: nowSeconds + 280,
        },
      ]}
    />
  );

  expect(
    screen.getByText(/Live update failed.*last successful update 3 min ago/i)
  ).toBeInTheDocument();
  expect(screen.getByText(/Live data · 3 min old/i)).toBeInTheDocument();
  expect(screen.getByText(/Last bus position/i)).toHaveTextContent("3 min old");
});


test("prefers provider vehicle-at-stop truth over geometric proximity", () => {
  const now = Math.floor(Date.now() / 1000);

  render(
    <BusStopDisplay
      stopId="164"
      stopName="Kauppatori"
      stop={{ id: "164", name: "Kauppatori" }}
      stops={[]}
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
          vehicleatstop: true,
          recordedattime: now - 10,
          expecteddeparturetime: now + 60,
        },
      ]}
    />
  );

  expect(screen.getByText("Bus at stop · board now")).toBeInTheDocument();
});

test("uses the browser language destination when Föli provides it", () => {
  const now = Math.floor(Date.now() / 1000);

  render(
    <BusStopDisplay
      stopId="164"
      stopName="Kauppatori"
      stops={[]}
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
          destinationdisplay_en: "Harbour",
          monitored: false,
          aimeddeparturetime: now + 300,
        },
      ]}
    />
  );

  expect(screen.getByText("Harbour")).toBeInTheDocument();
  expect(screen.queryByText("Satama")).not.toBeInTheDocument();
});

test("keeps counting down between provider refreshes instead of freezing", () => {
  vi.useFakeTimers();

  const serverTime = 1_900_000_000;
  const receivedAtMs = Date.now();

  render(
    <BusStopDisplay
      stopId="164"
      stopName="Kauppatori"
      serverTime={serverTime}
      receivedAtMs={receivedAtMs}
      loading={false}
      refreshing={false}
      error={false}
      onRefresh={() => {}}
      arrivals={[
        {
          lineref: "1",
          destinationdisplay: "Satama",
          monitored: true,
          expecteddeparturetime: serverTime + 300,
        },
      ]}
    />
  );

  expect(screen.getByText("5 min")).toBeInTheDocument();

  // No new payload arrives; only the clock moves.
  act(() => {
    vi.advanceTimersByTime(120_000);
  });

  expect(screen.getByText("3 min")).toBeInTheDocument();
});

test("drops a departure from the board once it has left, without new data", () => {
  vi.useFakeTimers();

  const serverTime = 1_900_000_000;
  const receivedAtMs = Date.now();

  render(
    <BusStopDisplay
      stopId="164"
      stopName="Kauppatori"
      serverTime={serverTime}
      receivedAtMs={receivedAtMs}
      loading={false}
      refreshing={false}
      error={false}
      onRefresh={() => {}}
      arrivals={[
        {
          lineref: "1",
          destinationdisplay: "Satama",
          monitored: true,
          expecteddeparturetime: serverTime + 60,
        },
      ]}
    />
  );

  expect(screen.getByText("Satama")).toBeInTheDocument();

  act(() => {
    vi.advanceTimersByTime(120_000);
  });

  expect(screen.queryByText("Satama")).not.toBeInTheDocument();
  expect(screen.getByText("No upcoming departures.")).toBeInTheDocument();
});
