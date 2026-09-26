import { act, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import BusStopDisplay from "./BusStopDisplay";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
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

function destinationBoard(arrival) {
  const now = Math.floor(Date.now() / 1000);

  return (
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
          monitored: false,
          aimeddeparturetime: now + 300,
          ...arrival,
        },
      ]}
    />
  );
}

// The sign on the bus reads "Satama". A board that said only "Harbour" gave
// an English reader nothing to match against the bus pulling in.
test("leads with the destination the bus sign shows, the reader's language beside it", () => {
  render(
    destinationBoard({
      destinationdisplay: "Satama",
      destinationdisplay_en: "Harbour",
      destinationdisplay_sv: "Hamnen",
    })
  );

  expect(screen.getByText("Satama")).toBeInTheDocument();
  expect(screen.getByText("Harbour")).toHaveAttribute("lang", "en");
  expect(screen.queryByText("Hamnen")).not.toBeInTheDocument();
});

test("gives a Swedish reader the Swedish name beside the sign", () => {
  vi.spyOn(navigator, "languages", "get").mockReturnValue(["sv-FI", "en"]);

  render(
    destinationBoard({
      destinationdisplay: "Satama",
      destinationdisplay_en: "Harbour",
      destinationdisplay_sv: "Hamnen",
    })
  );

  expect(screen.getByText("Satama")).toBeInTheDocument();
  expect(screen.getByText("Hamnen")).toHaveAttribute("lang", "sv");
  expect(screen.queryByText("Harbour")).not.toBeInTheDocument();
});

test("adds nothing for a Finnish reader or a name that only repeats the sign", () => {
  vi.spyOn(navigator, "languages", "get").mockReturnValue(["fi-FI", "en"]);
  const { unmount } = render(
    destinationBoard({
      destinationdisplay: "Satama",
      destinationdisplay_en: "Harbour",
    })
  );
  expect(screen.getByText("Satama")).toBeInTheDocument();
  expect(screen.queryByText("Harbour")).not.toBeInTheDocument();
  unmount();
  vi.restoreAllMocks();

  render(
    destinationBoard({
      destinationdisplay: "Runosmäki",
      destinationdisplay_en: "Runosmäki",
    })
  );
  expect(screen.getAllByText("Runosmäki")).toHaveLength(1);
});

test("falls back to a translated name when the sign text is missing", () => {
  render(destinationBoard({ destinationdisplay_en: "Harbour" }));

  expect(screen.getAllByText("Harbour")).toHaveLength(1);
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


test("shows scheduled departures when realtime is unavailable instead of an empty board", () => {
  const now = Math.floor(Date.now() / 1000);

  render(
    <BusStopDisplay
      stopId="621"
      stopName="Takakirves"
      stops={[]}
      routesByShortName={new Map()}
      serverTime={now}
      receivedAtMs={Date.now()}
      realtimeAvailable={false}
      scheduleAvailable
      loading={false}
      refreshing={false}
      error={false}
      onRefresh={() => {}}
      arrivals={[
        {
          lineref: "32",
          destinationdisplay: "Varissuo",
          monitored: false,
          aimeddeparturetime: now + 300,
        },
      ]}
    />
  );

  expect(screen.getByText("Varissuo")).toBeInTheDocument();
  expect(
    screen.getByText(/Live updates are unavailable.*showing scheduled Föli times/i)
  ).toBeInTheDocument();
  expect(screen.queryByText("No upcoming departures.")).not.toBeInTheDocument();
});

test("shows tomorrow's next scheduled service instead of an empty board", () => {
  const nowMs = Date.parse("2026-09-21T12:45:00Z");
  const now = Math.floor(nowMs / 1000);
  vi.spyOn(Date, "now").mockReturnValue(nowMs);

  render(
    <BusStopDisplay
      stopId="621"
      stopName="Takakirves"
      stops={[]}
      routesByShortName={new Map()}
      serverTime={now}
      receivedAtMs={nowMs}
      realtimeAvailable
      scheduleAvailable
      loading={false}
      refreshing={false}
      error={false}
      onRefresh={() => {}}
      arrivals={[
        {
          lineref: "32",
          destinationdisplay: "Varissuo",
          monitored: false,
          aimeddeparturetime: Date.parse("2026-09-22T03:30:00Z") / 1000,
        },
      ]}
    />
  );

  expect(screen.getByText("Varissuo")).toBeInTheDocument();
  expect(screen.getByRole("cell", { name: "Tomorrow 06:30" })).toBeInTheDocument();
  expect(
    screen.getByText(/No live departure is published right now.*next scheduled Föli times/i)
  ).toBeInTheDocument();
  expect(screen.queryByText("No upcoming departures.")).not.toBeInTheDocument();
});

test("keeps a future planned row visible when its realtime estimate has gone stale", () => {
  const now = Math.floor(Date.now() / 1000);

  render(
    <BusStopDisplay
      stopId="621"
      stopName="Takakirves"
      stops={[]}
      routesByShortName={new Map()}
      serverTime={now}
      loading={false}
      refreshing={false}
      error={false}
      onRefresh={() => {}}
      arrivals={[
        {
          lineref: "32",
          destinationdisplay: "Varissuo",
          monitored: true,
          expecteddeparturetime: now - 120,
          aimeddeparturetime: now + 300,
        },
      ]}
    />
  );

  expect(screen.getByText("Varissuo")).toBeInTheDocument();
  expect(screen.getByText("5 min")).toBeInTheDocument();
});

// Line 1's yellow is 1.07:1 against the white row, so the badge had no
// visible edge at all: only the black number floated there.
test("outlines a line badge too light to stand out from the row", () => {
  const now = Math.floor(Date.now() / 1000);
  const routes = new Map([
    ["1", { id: "1", shortName: "1", color: "#ffff00", textColor: "#000000" }],
    ["7", { id: "7", shortName: "7", color: "#007985", textColor: "#ffffff" }],
  ]);

  render(
    <BusStopDisplay
      stopId="164"
      stopName="Kauppatori"
      stops={[]}
      routesByShortName={routes}
      serverTime={now}
      loading={false}
      refreshing={false}
      error={false}
      onRefresh={() => {}}
      arrivals={[
        { lineref: "1", destinationdisplay: "Satama", aimeddeparturetime: now + 200 },
        { lineref: "7", destinationdisplay: "Runosmäki", aimeddeparturetime: now + 400 },
      ]}
    />
  );

  expect(screen.getByText("1").style.boxShadow).toContain("inset");
  expect(screen.getByText("7").style.boxShadow).toBe("");
});

// Föli can cancel a departure at a stop (ALERTS cancellations, active from
// about ten minutes before the planned arrival). The notice sat in Service
// updates while the same bus kept counting down on the board as if coming.
test("marks a departure Föli has cancelled at this stop instead of counting it down", () => {
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
      onStartRide={() => {}}
      cancellations={[{ line: "1", scheduledTime: now + 240 }]}
      arrivals={[
        {
          lineref: "1",
          destinationdisplay: "Satama",
          monitored: false,
          tripref: "trip-cancelled",
          aimedarrivaltime: now + 240,
          aimeddeparturetime: now + 240,
        },
        {
          lineref: "1",
          destinationdisplay: "Satama",
          monitored: false,
          tripref: "trip-running",
          aimedarrivaltime: now + 900,
          aimeddeparturetime: now + 900,
        },
      ]}
    />
  );

  const [cancelledRow, runningRow] = screen.getAllByRole("row").slice(1);
  expect(within(cancelledRow).getByText("Cancelled", { selector: "td" })).toBeInTheDocument();
  expect(
    within(cancelledRow).queryByRole("button", { name: "Alert me when to get off" })
  ).not.toBeInTheDocument();
  expect(within(runningRow).getByText("15 min")).toBeInTheDocument();
  expect(
    within(runningRow).getByRole("button", { name: "Alert me when to get off" })
  ).toBeInTheDocument();
});
