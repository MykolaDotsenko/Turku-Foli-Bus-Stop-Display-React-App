import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import RideMode from "./RideMode";

function session(stage = "next") {
  return {
    id: "ride-1",
    lineRef: "1",
    tripRef: "trip-1",
    routeType: 3,
    destination: "Satama",
    stage,
    targetStop: { id: "32", name: "Puistokatu" },
    previousStop: { id: "164", name: "Kauppatori" },
    nextStop: { id: "4", name: "Turun linna" },
    boardingStop: { id: "164", name: "Kauppatori" },
    options: { locationBackup: true, notifications: true },
  };
}

test("shows the action the passenger needs instead of a map", () => {
  render(
    <RideMode
      session={session("next")}
      runtime={{
        trackingHealth: "live",
        liveEtaSec: 70,
        scheduleEtaSec: 80,
        remainingStops: 1,
        targetMatchBy: "trip",
      }}
      gps={{
        status: "active",
        shapeUsable: true,
        onRoute: true,
        routeDistanceM: 420,
        routeEtaSec: 55,
        distanceM: 300,
        error: "",
      }}
      wakeLockState="active"
      onTestAlert={() => {}}
      onEndRide={() => {}}
      onOpenStop={() => {}}
    />
  );

  expect(
    screen.getByRole("heading", { name: "Your stop is next" })
  ).toBeInTheDocument();
  expect(screen.getByText("Press the STOP button now.")).toBeInTheDocument();
  expect(screen.getByText("Puistokatu")).toBeInTheDocument();
  expect(screen.getByText("after Kauppatori", { exact: false })).toBeInTheDocument();
  expect(screen.queryByText(/map/i)).not.toBeInTheDocument();
});

test("uses generic NEXT wording for non-bus modes", () => {
  render(
    <RideMode
      session={{ ...session("next"), routeType: 4 }}
      runtime={{
        trackingHealth: "live",
        liveEtaSec: 70,
        scheduleEtaSec: 80,
        remainingStops: 1,
        targetMatchBy: "trip",
      }}
      gps={{
        status: "active",
        shapeUsable: true,
        onRoute: true,
        routeDistanceM: 480,
        routeEtaSec: 60,
        error: "",
      }}
      wakeLockState="active"
      onTestAlert={() => {}}
      onEndRide={() => {}}
      onOpenStop={() => {}}
    />
  );

  expect(
    screen.getByText("Get ready to exit at the next stop.")
  ).toBeInTheDocument();
  expect(screen.queryByText("Press the STOP button now.")).not.toBeInTheDocument();
  expect(screen.getByText(/about 480 m to go/i)).toBeInTheDocument();
});

// The hook already decides which source is fresh enough to trust. If the
// panel re-derives that order it can show a confident estimate from a stale
// GPS fix while the badge next to it says tracking has degraded.
test("shows the estimate the hook resolved rather than re-deriving one", () => {
  render(
    <RideMode
      session={session("soon")}
      runtime={{
        trackingHealth: "schedule",
        liveEtaSec: 70,
        scheduleEtaSec: 200,
        etaSec: 200,
        remainingStops: 2,
        targetMatchBy: "",
      }}
      gps={{
        status: "active",
        shapeUsable: true,
        onRoute: true,
        routeDistanceM: 900,
        routeEtaSec: 55,
        error: "",
      }}
      wakeLockState="active"
      onTestAlert={() => {}}
      onEndRide={() => {}}
      onOpenStop={() => {}}
    />
  );

  expect(screen.getByText("~4 min")).toBeInTheDocument();
  expect(screen.queryByText("~1 min")).not.toBeInTheDocument();
});

// A distance reads as harder fact than an estimate, so a fix frozen by a
// tunnel is the number a passenger will trust over the alert badge.
test("stops presenting a stale fix as where the passenger is now", () => {
  render(
    <RideMode
      session={session("soon")}
      runtime={{
        trackingHealth: "delayed",
        etaSec: 240,
        remainingStops: 2,
        gpsAgeSec: 300,
        targetMatchBy: "trip",
      }}
      gps={{
        status: "active",
        shapeUsable: true,
        onRoute: true,
        routeDistanceM: 420,
        distanceM: 380,
        error: "",
      }}
      wakeLockState="active"
      onTestAlert={() => {}}
      onEndRide={() => {}}
      onOpenStop={() => {}}
    />
  );

  expect(screen.getByText("Lost track of your location")).toBeInTheDocument();
  expect(screen.getByText("last seen 5 min ago")).toBeInTheDocument();
  expect(screen.queryByText(/about 420 m to go/i)).not.toBeInTheDocument();
  expect(screen.queryByText("Following you along the route")).not.toBeInTheDocument();
});

test("says the stop is behind you instead of showing zero metres", () => {
  render(
    <RideMode
      session={session("missed")}
      runtime={{
        trackingHealth: "live",
        etaSec: -120,
        remainingStops: 0,
        gpsAgeSec: 4,
        targetMatchBy: "trip",
      }}
      gps={{
        status: "active",
        shapeUsable: true,
        onRoute: true,
        routeDistanceM: -180,
        error: "",
      }}
      wakeLockState="active"
      onTestAlert={() => {}}
      onEndRide={() => {}}
      onOpenStop={() => {}}
    />
  );

  expect(screen.getByText("about 180 m past your stop")).toBeInTheDocument();
  expect(screen.queryByText("about 0 m to go")).not.toBeInTheDocument();
});

// The stage is the app's conclusion from every source it has. Tiles that
// keep counting past it leave "1 stop · ~2 min" beside a headline saying to
// get off, and the passenger cannot tell which half to believe.
test("stops counting down once it is telling the passenger to get off", () => {
  render(
    <RideMode
      session={session("now")}
      runtime={{
        trackingHealth: "live",
        // The timetable still believes the stop is two minutes out; the
        // vehicle is already standing at it.
        etaSec: 120,
        remainingStops: 1,
        targetMatchBy: "trip",
      }}
      gps={{ status: "off", distanceM: null, error: "" }}
      wakeLockState="active"
      onTestAlert={() => {}}
      onEndRide={() => {}}
      onOpenStop={() => {}}
    />
  );

  expect(screen.getByText("you are here")).toBeInTheDocument();
  expect(screen.getByText("now")).toBeInTheDocument();
  expect(screen.queryByText("1 stop")).not.toBeInTheDocument();
  expect(screen.queryByText("~2 min")).not.toBeInTheDocument();
});

// At the one moment that matters the panel used to explain its own repeat
// behaviour instead of saying what to do with your body.
test("tells the passenger what to do at the moment of getting off", () => {
  render(
    <RideMode
      session={session("now")}
      runtime={{ trackingHealth: "live", etaSec: 0, remainingStops: 0 }}
      gps={{ status: "off", distanceM: null, error: "" }}
      wakeLockState="active"
      onTestAlert={() => {}}
      onEndRide={() => {}}
      onOpenStop={() => {}}
    />
  );

  const instruction = screen.getByRole("alert");
  expect(instruction).toHaveTextContent("Move to the doors and step off here.");
  expect(instruction).not.toHaveTextContent(/alert repeats/i);
});

test("says the stop is behind you rather than counting stops to it", () => {
  render(
    <RideMode
      session={session("missed")}
      runtime={{ trackingHealth: "live", etaSec: 90, remainingStops: 2 }}
      gps={{ status: "off", distanceM: null, error: "" }}
      wakeLockState="active"
      onTestAlert={() => {}}
      onEndRide={() => {}}
      onOpenStop={() => {}}
    />
  );

  expect(screen.getByText("behind you")).toBeInTheDocument();
  expect(screen.queryByText("2 stops")).not.toBeInTheDocument();
  expect(screen.queryByText("~2 min")).not.toBeInTheDocument();
});

test("offers recovery at the next stop after a missed-stop signal", () => {
  const onEndRide = vi.fn();
  const onOpenStop = vi.fn();

  render(
    <RideMode
      session={session("missed")}
      runtime={{
        trackingHealth: "delayed",
        liveEtaSec: -90,
        scheduleEtaSec: -120,
        remainingStops: 0,
        targetMatchBy: "",
      }}
      gps={{ status: "error", distanceM: null, error: "" }}
      wakeLockState="inactive"
      onTestAlert={() => {}}
      onEndRide={onEndRide}
      onOpenStop={onOpenStop}
    />
  );

  fireEvent.click(screen.getByRole("button", { name: "Open next stop" }));

  expect(onEndRide).toHaveBeenCalledTimes(1);
  expect(onOpenStop).toHaveBeenCalledWith("4");
});
