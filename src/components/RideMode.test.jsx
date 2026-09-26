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

// Nothing in a web page can see a silent switch or a muted volume, so the
// only honest check on "you will hear me" is to ask.
test("asks whether the test alert was actually heard, and helps when it was not", () => {
  const onTestAlert = vi.fn();
  render(
    <RideMode
      session={session("boarded")}
      runtime={{ trackingHealth: "live", etaSec: 900, remainingStops: 5 }}
      gps={{ status: "off", distanceM: null, error: "" }}
      wakeLockState="active"
      onTestAlert={onTestAlert}
      onEndRide={() => {}}
      onOpenStop={() => {}}
    />
  );

  expect(screen.getByText("Did you hear the test alert?")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "No" }));
  expect(screen.getByText(/Turn the media volume up/)).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Play it again" }));
  expect(onTestAlert).toHaveBeenCalledTimes(1);

  fireEvent.click(screen.getByRole("button", { name: "I can hear it now" }));
  expect(screen.queryByText(/Turn the media volume up/)).not.toBeInTheDocument();
});

// A short hop reaches SOON within a stop or two, and that is exactly the
// ride where there is least time to discover a muted phone.
test("still offers the sound check on a short ride", () => {
  render(
    <RideMode
      session={session("soon")}
      runtime={{ trackingHealth: "live", etaSec: 240, remainingStops: 2 }}
      gps={{ status: "off", distanceM: null, error: "" }}
      wakeLockState="active"
      onTestAlert={() => {}}
      onEndRide={() => {}}
      onOpenStop={() => {}}
    />
  );

  expect(screen.getByText("Did you hear the test alert?")).toBeInTheDocument();
});

test("does not interrupt the approach with a sound check", () => {
  render(
    <RideMode
      session={session("next")}
      runtime={{ trackingHealth: "live", etaSec: 70, remainingStops: 1 }}
      gps={{ status: "off", distanceM: null, error: "" }}
      wakeLockState="active"
      onTestAlert={() => {}}
      onEndRide={() => {}}
      onOpenStop={() => {}}
    />
  );

  expect(screen.queryByText("Did you hear the test alert?")).not.toBeInTheDocument();
});

// A warning that only states a fact leaves the passenger with no move.
test("turns the wrong-bus warning into the two answers it is asking for", () => {
  const onEndRide = vi.fn();
  render(
    <RideMode
      session={session("soon")}
      runtime={{ trackingHealth: "live", etaSec: 240, remainingStops: 2 }}
      gps={{ status: "off-route", distanceM: 900, offRouteSuspected: true, error: "" }}
      wakeLockState="active"
      onTestAlert={() => {}}
      onEndRide={onEndRide}
      onOpenStop={() => {}}
    />
  );

  const warning = screen.getByRole("alert");
  expect(warning).toHaveTextContent("Check your bus");
  expect(warning).toHaveTextContent("line 1");
  expect(warning).toHaveTextContent("Satama");

  fireEvent.click(screen.getByRole("button", { name: "Yes, keep tracking" }));
  expect(screen.queryByText("Check your bus")).not.toBeInTheDocument();
  expect(onEndRide).not.toHaveBeenCalled();
});

test("a test alert is preparation, so it is gone once it is time to leave", () => {
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

  expect(screen.queryByRole("button", { name: "Test alert" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "I'm getting off" })).toBeInTheDocument();
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

function renderPanel(runtime, stage = "soon") {
  return render(
    <RideMode
      session={session(stage)}
      runtime={{
        trackingHealth: "schedule",
        remainingStops: 2,
        targetMatchBy: "",
        ...runtime,
      }}
      gps={{ status: "off", error: "" }}
      wakeLockState="active"
      onTestAlert={() => {}}
      onEndRide={() => {}}
      onOpenStop={() => {}}
    />
  );
}

test("never calls the bus confirmed once live tracking has been lost", () => {
  // The last match survives failed polls. Beside "Going by the timetable"
  // and the degraded banner, "Your bus is confirmed" said the opposite.
  renderPanel({ trackingHealth: "schedule", targetMatchBy: "dated-journey" });

  expect(screen.getByText("Going by the timetable")).toBeInTheDocument();
  expect(screen.getByText("Looking for your bus")).toBeInTheDocument();
  expect(screen.queryByText("Your bus is confirmed")).not.toBeInTheDocument();
});

test("agrees with its own badge when the bus is seen at the stop before", () => {
  // Live at the stop before, not yet listed at the exit stop: the badge said
  // "Following your bus" while the row beneath it said "Looking for it".
  renderPanel({
    trackingHealth: "live",
    previousSeen: true,
    targetLive: false,
  });

  expect(screen.getByText("Following your bus")).toBeInTheDocument();
  expect(screen.getByText("Your bus is confirmed")).toBeInTheDocument();
  expect(screen.getByText("on its way to Kauppatori")).toBeInTheDocument();
  expect(screen.queryByText("Looking for your bus")).not.toBeInTheDocument();
});

test("says the live data is catching up, not that the bus is late", () => {
  renderPanel({ trackingHealth: "delayed" });

  expect(screen.getByText("Live tracking is catching up")).toBeInTheDocument();
  expect(screen.queryByText(/lagging/i)).not.toBeInTheDocument();
});

test("does not say about now while the timetable is behind the bus", () => {
  // The timetable's time for the stop has come, but two stops remain.
  renderPanel({ etaSec: 10, etaSource: "schedule", remainingStops: 2 });

  expect(screen.getByText("running late")).toBeInTheDocument();
  expect(screen.queryByText("about now")).not.toBeInTheDocument();
});

test("trusts a live estimate of about now even when the timetable counts more stops", () => {
  renderPanel({
    trackingHealth: "live",
    targetLive: true,
    etaSec: 20,
    etaSource: "live",
    remainingStops: 2,
  });

  expect(screen.getByText("about now")).toBeInTheDocument();
  expect(screen.getByText("Your bus is confirmed")).toBeInTheDocument();
});

function panelAt(stage) {
  return (
    <RideMode
      session={session(stage)}
      runtime={{ trackingHealth: "live", targetLive: true, remainingStops: 1 }}
      gps={{ status: "off", error: "" }}
      wakeLockState="active"
      onTestAlert={() => {}}
      onEndRide={() => {}}
      onOpenStop={() => {}}
    />
  );
}

test("promises nothing about a map at the start of the ride", () => {
  render(panelAt("boarded"));

  expect(screen.queryByText(/map/i)).not.toBeInTheDocument();
});

test("offers a single way out once it is time to get off", () => {
  // "I'm getting off" and "End ride" did exactly the same thing, side by
  // side, at the one moment there is no time to work out the difference.
  render(panelAt("now"));

  expect(
    screen.getByRole("button", { name: "I'm getting off" })
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "End ride" })
  ).not.toBeInTheDocument();
});

test("brings itself back into view when the stop is next", () => {
  // On a phone the panel scrolls with the page, so a passenger reading the
  // board below it would otherwise miss the one screen that matters.
  const scrollIntoView = vi.fn();
  const originalScroll = globalThis.HTMLElement.prototype.scrollIntoView;
  const originalRect = globalThis.HTMLElement.prototype.getBoundingClientRect;
  globalThis.HTMLElement.prototype.scrollIntoView = scrollIntoView;
  globalThis.HTMLElement.prototype.getBoundingClientRect = () => ({
    top: -500,
    bottom: -20,
    left: 0,
    right: 360,
    width: 360,
    height: 480,
  });

  try {
    const { rerender } = render(panelAt("boarded"));
    rerender(panelAt("soon"));
    expect(scrollIntoView).not.toHaveBeenCalled();

    rerender(panelAt("next"));
    expect(scrollIntoView).toHaveBeenCalledTimes(1);

    rerender(panelAt("now"));
    expect(scrollIntoView).toHaveBeenCalledTimes(2);
  } finally {
    globalThis.HTMLElement.prototype.scrollIntoView = originalScroll;
    globalThis.HTMLElement.prototype.getBoundingClientRect = originalRect;
  }
});
