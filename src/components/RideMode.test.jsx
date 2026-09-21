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
  expect(screen.getByText(/480 m along route/i)).toBeInTheDocument();
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
