import { describe, expect, it } from "vitest";
import {
  RIDE_STAGE,
  arrivalEtaSeconds,
  buildRidePlan,
  evaluateRideStage,
  gtfsTimeToSeconds,
  matchRideArrival,
  plannedRideProgress,
  resolveRideBoardingIndex,
} from "./rideProgress";

describe("ride progress", () => {
  it("parses GTFS times beyond midnight", () => {
    expect(gtfsTimeToSeconds("25:02:03")).toBe(90123);
    expect(gtfsTimeToSeconds("bad")).toBeNull();
  });

  it("builds an anchored plan with GTFS shape distances", () => {
    const stopsById = new Map([
      ["10", { id: "10", name: "Board" }],
      ["20", { id: "20", name: "Before" }],
      ["30", { id: "30", name: "Target" }],
      ["40", { id: "40", name: "After" }],
    ]);
    const plan = buildRidePlan({
      stopTimes: [
        {
          stopId: "10",
          departureTime: "12:00:00",
          stopSequence: 1,
          shapeDistTraveled: 0,
        },
        {
          stopId: "20",
          departureTime: "12:04:00",
          stopSequence: 2,
          shapeDistTraveled: 900,
        },
        {
          stopId: "30",
          departureTime: "12:08:00",
          stopSequence: 3,
          shapeDistTraveled: 1800,
        },
        {
          stopId: "40",
          departureTime: "12:12:00",
          stopSequence: 4,
          shapeDistTraveled: 2700,
        },
      ],
      currentStopId: "10",
      targetStopId: "30",
      targetStopSequence: 3,
      stopsById,
      departureEpochSec: 1_000,
    });

    expect(plan.previousStop.name).toBe("Before");
    expect(plan.targetStop.predictedEpochSec).toBe(1_480);
    expect(plan.nextStop.name).toBe("After");
    expect(plan.boardingStop.shapeDistTraveled).toBe(0);
    expect(plan.targetStop.shapeDistTraveled).toBe(1800);
  });

  it("disambiguates a loop boarding stop from the SIRI aimed time", () => {
    const stopTimes = [
      { stopId: "10", departureTime: "08:00:00", stopSequence: 1 },
      { stopId: "20", departureTime: "08:10:00", stopSequence: 2 },
      { stopId: "10", departureTime: "08:30:00", stopSequence: 3 },
      { stopId: "30", departureTime: "08:40:00", stopSequence: 4 },
    ];

    const helsinkiEightThirty =
      new Date("2026-09-21T05:30:00Z").getTime() / 1000;

    expect(
      resolveRideBoardingIndex(stopTimes, "10", helsinkiEightThirty)
    ).toBe(2);
  });

  it("refuses a repeated boarding stop without safe time disambiguation", () => {
    const stopTimes = [
      { stopId: "10", departureTime: "08:00:00", stopSequence: 1 },
      { stopId: "10", departureTime: "08:30:00", stopSequence: 2 },
    ];

    expect(resolveRideBoardingIndex(stopTimes, "10", null)).toBe(-1);
  });

  it("targets the exact stop sequence when a loop revisits a stop", () => {
    const stopsById = new Map([
      ["10", { id: "10", name: "Board" }],
      ["20", { id: "20", name: "Loop stop" }],
      ["30", { id: "30", name: "Between" }],
    ]);

    const plan = buildRidePlan({
      stopTimes: [
        { stopId: "10", departureTime: "12:00:00", stopSequence: 1 },
        { stopId: "20", departureTime: "12:05:00", stopSequence: 2 },
        { stopId: "30", departureTime: "12:10:00", stopSequence: 3 },
        { stopId: "20", departureTime: "12:15:00", stopSequence: 4 },
      ],
      currentStopId: "10",
      targetStopId: "20",
      targetStopSequence: 4,
      stopsById,
      departureEpochSec: 1_000,
    });

    expect(plan.targetStop.stopSequence).toBe(4);
    expect(plan.previousStop.id).toBe("30");
  });

  it("matches the strongest available ride identity", () => {
    const rows = [
      {
        lineref: "1",
        tripref: "trip-a",
        datedvehiclejourneyref: "journey-a",
        vehicleref: "bus-a",
        originaimeddeparturetime: 1000,
      },
    ];

    expect(
      matchRideArrival(rows, {
        datedVehicleJourneyRef: "journey-a",
        tripRef: "wrong",
      })?.matchedBy
    ).toBe("dated-journey");

    expect(
      matchRideArrival(rows, {
        tripRef: "trip-a",
      })?.matchedBy
    ).toBe("trip");

    expect(
      matchRideArrival(rows, {
        lineRef: "1",
        originAimedDepartureTime: 1040,
      })?.matchedBy
    ).toBe("line-origin-time");
  });

  it("keeps missing evidence neutral", () => {
    const stage = evaluateRideStage(RIDE_STAGE.BOARDED, {
      liveEtaSec: null,
      scheduleEtaSec: null,
      remainingStops: null,
    });
    expect(stage.stage).toBe(RIDE_STAGE.BOARDED);
  });

  it("keeps schedule-only evidence from claiming NOW", () => {
    const next = evaluateRideStage(RIDE_STAGE.BOARDED, {
      scheduleEtaSec: 5,
      remainingStops: 1,
    });

    expect(next.stage).toBe(RIDE_STAGE.NEXT);
    expect(next.confidence).toBe("schedule");
  });

  it("requires strong evidence for NOW", () => {
    const next = evaluateRideStage(RIDE_STAGE.NEXT, {
      scheduleEtaSec: -20,
      providerDistanceM: 55,
      providerPositionAgeSec: 10,
    });

    expect(next.stage).toBe(RIDE_STAGE.NOW);
    expect(next.reason).toBe("provider-near-target");
  });

  it("uses accurate on-shape GPS route distance for NEXT and NOW", () => {
    const next = evaluateRideStage(RIDE_STAGE.BOARDED, {
      gpsShapeAvailable: true,
      gpsShapeUsable: true,
      gpsOnRoute: true,
      gpsAccuracyM: 20,
      gpsRouteDistanceM: 520,
    });

    expect(next.stage).toBe(RIDE_STAGE.NEXT);
    expect(next.reason).toBe("gps-route-distance");

    const now = evaluateRideStage(RIDE_STAGE.NEXT, {
      gpsShapeAvailable: true,
      gpsShapeUsable: true,
      gpsOnRoute: true,
      gpsAccuracyM: 18,
      gpsRouteDistanceM: 85,
    });

    expect(now.stage).toBe(RIDE_STAGE.NOW);
    expect(now.reason).toBe("gps-route-arrival");
  });

  it("does not use off-route GPS as get-off evidence", () => {
    const stage = evaluateRideStage(RIDE_STAGE.BOARDED, {
      gpsShapeAvailable: true,
      gpsShapeUsable: true,
      gpsOnRoute: false,
      gpsAccuracyM: 15,
      gpsRouteDistanceM: 70,
      scheduleEtaSec: 600,
      remainingStops: 4,
    });

    expect(stage.stage).toBe(RIDE_STAGE.BOARDED);
  });

  it("lets a live prediction override a slipped timetable", () => {
    const evaluated = evaluateRideStage(RIDE_STAGE.BOARDED, {
      liveEtaSec: 250,
      scheduleEtaSec: 60,
      remainingStops: 0,
    });

    expect(evaluated.stage).toBe(RIDE_STAGE.SOON);
    expect(evaluated.confidence).toBe("live");
  });

  it("reaches NOW when NEXT evidence and proximity arrive together", () => {
    const evaluated = evaluateRideStage(RIDE_STAGE.SOON, {
      previousPassedConfirmed: true,
      gpsShapeAvailable: false,
      gpsDistanceM: 40,
      gpsAccuracyM: 20,
    });

    expect(evaluated.stage).toBe(RIDE_STAGE.NOW);
    expect(evaluated.reason).toBe("device-near-target");
  });

  it("can declare a missed stop from NEXT using strong post-target evidence", () => {
    const evaluated = evaluateRideStage(RIDE_STAGE.NEXT, {
      gpsPassedTarget: true,
    });

    expect(evaluated.stage).toBe(RIDE_STAGE.MISSED);
    expect(evaluated.reason).toBe("gps-route-passed");
  });

  it("never rolls a stage backwards", () => {
    expect(
      evaluateRideStage(RIDE_STAGE.NEXT, {
        scheduleEtaSec: 900,
        remainingStops: 8,
      }).stage
    ).toBe(RIDE_STAGE.NEXT);
  });

  it("only marks missed after post-target evidence", () => {
    expect(
      evaluateRideStage(RIDE_STAGE.NOW, {
        scheduleEtaSec: -300,
      }).stage
    ).toBe(RIDE_STAGE.NOW);

    expect(
      evaluateRideStage(RIDE_STAGE.NOW, {
        gpsPassedTarget: true,
      }).stage
    ).toBe(RIDE_STAGE.MISSED);
  });

  it("treats the bus leaving as a miss only before the get-off alert fired", () => {
    // Never alerted, vehicle gone: the passenger is still aboard.
    expect(
      evaluateRideStage(RIDE_STAGE.NEXT, {
        targetPassedConfirmed: true,
      }).stage
    ).toBe(RIDE_STAGE.MISSED);
  });

  it("does not accuse a passenger who already got off of missing the stop", () => {
    // A successful alight looks exactly like this: the get-off alert fired,
    // the bus left the stop, and the phone walked away from it. Announcing
    // "get off at the next stop" here would send someone standing at their
    // own destination back onto a bus.
    const afterGettingOff = evaluateRideStage(RIDE_STAGE.NOW, {
      targetPassedConfirmed: true,
      gpsMovedAwayAfterNear: true,
    });

    expect(afterGettingOff.stage).toBe(RIDE_STAGE.NOW);
  });

  it("computes live and planned ETA", () => {
    expect(
      arrivalEtaSeconds({ expectedarrivaltime: 1_120 }, 1_000)
    ).toBe(120);

    const plan = {
      targetPredictedEpochSec: 1_300,
      stopsToTarget: [
        { predictedEpochSec: 1_100 },
        { predictedEpochSec: 1_300 },
      ],
    };
    expect(plannedRideProgress(plan, 1_050)).toEqual({
      etaSec: 250,
      remainingStops: 2,
    });
  });

  it("announces nothing at all before any evidence has arrived", () => {
    // Every signal is "not known yet", exactly as a ride begins. Coercing
    // those to zero would read as zero metres and zero seconds to go.
    const noEvidence = {
      liveEtaSec: null,
      scheduleEtaSec: null,
      remainingStops: null,
      providerDistanceM: null,
      providerPositionAgeSec: null,
      gpsDistanceM: null,
      gpsAccuracyM: null,
    };

    let stage = RIDE_STAGE.BOARDED;
    for (let tick = 0; tick < 3; tick += 1) {
      stage = evaluateRideStage(stage, noEvidence).stage;
    }

    expect(stage).toBe(RIDE_STAGE.BOARDED);
  });

  it("lets a live prediction override a timetable that has silently slipped", () => {
    // Bus is five minutes late: the anchored schedule says the stop is due,
    // the provider says it is still 400 seconds out. Announcing now would
    // put the passenger at the door five minutes early.
    const signals = {
      liveEtaSec: 250,
      scheduleEtaSec: 60,
      remainingStops: 0,
    };

    const evaluated = evaluateRideStage(RIDE_STAGE.BOARDED, signals);
    expect(evaluated.stage).toBe(RIDE_STAGE.SOON);
    expect(evaluated.confidence).toBe("live");
  });

  it("still uses the timetable once the provider stops answering", () => {
    const signals = {
      liveEtaSec: null,
      scheduleEtaSec: 60,
      remainingStops: 0,
    };

    const evaluated = evaluateRideStage(RIDE_STAGE.BOARDED, signals);
    expect(evaluated.stage).toBe(RIDE_STAGE.NEXT);
    expect(evaluated.confidence).toBe("schedule");
  });

  it("does not let a slipped timetable pull the ride forward to SOON either", () => {
    const signals = {
      liveEtaSec: 900,
      scheduleEtaSec: 120,
      remainingStops: 1,
    };

    expect(evaluateRideStage(RIDE_STAGE.BOARDED, signals).stage).toBe(
      RIDE_STAGE.BOARDED
    );
  });

  it("reaches NOW in the same evaluation that first proves the ride is ending", () => {
    // Arriving evidence and proximity can land in one poll; holding the
    // get-off alert back a tick is a tick at the worst possible moment.
    const evaluated = evaluateRideStage(RIDE_STAGE.SOON, {
      previousPassedConfirmed: true,
      gpsDistanceM: 40,
      gpsAccuracyM: 20,
    });

    expect(evaluated.stage).toBe(RIDE_STAGE.NOW);
    expect(evaluated.reason).toBe("device-near-target");
  });

  it("declares the stop missed from NEXT when live tracking died on approach", () => {
    // The tunnel case: the stage never reached NOW, the bus passed the stop,
    // and only the device knows. The panel must not keep saying "next".
    const evaluated = evaluateRideStage(RIDE_STAGE.NEXT, {
      gpsMovedAwayAfterNear: true,
    });

    expect(evaluated.stage).toBe(RIDE_STAGE.MISSED);
    expect(evaluated.reason).toBe("device-moved-away");
  });

  it("never declares a miss before the ride is anywhere near its end", () => {
    const evaluated = evaluateRideStage(RIDE_STAGE.SOON, {
      gpsMovedAwayAfterNear: true,
      targetPassedConfirmed: true,
    });

    expect(evaluated.stage).not.toBe(RIDE_STAGE.MISSED);
  });
});
