import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import RideMode from "./RideMode";

function session(stage = "next") {
  return {
    id: "ride-1",
    lineRef: "1",
    tripRef: "trip-1",
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
      gps={{ status: "active", distanceM: 420, error: "" }}
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
