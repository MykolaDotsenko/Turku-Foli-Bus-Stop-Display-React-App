import { describe, expect, it } from "vitest";
import {
  RIDE_STAGE,
  arrivalEtaSeconds,
  buildRidePlan,
  evaluateRideStage,
  gtfsTimeToSeconds,
  matchRideArrival,
  plannedRideProgress,
} from "./rideProgress";

describe("ride progress", () => {
  it("parses GTFS times beyond midnight", () => {
    expect(gtfsTimeToSeconds("25:02:03")).toBe(90123);
    expect(gtfsTimeToSeconds("bad")).toBeNull();
  });

  it("builds an anchored plan and recovery stop", () => {
    const stopsById = new Map([
      ["10", { id: "10", name: "Board" }],
      ["20", { id: "20", name: "Before" }],
      ["30", { id: "30", name: "Target" }],
      ["40", { id: "40", name: "After" }],
    ]);
    const plan = buildRidePlan({
      stopTimes: [
        { stopId: "10", departureTime: "12:00:00", stopSequence: 1 },
        { stopId: "20", departureTime: "12:04:00", stopSequence: 2 },
        { stopId: "30", departureTime: "12:08:00", stopSequence: 3 },
        { stopId: "40", departureTime: "12:12:00", stopSequence: 4 },
      ],
      currentStopId: "10",
      targetStopId: "30",
      stopsById,
      departureEpochSec: 1_000,
    });

    expect(plan.previousStop.name).toBe("Before");
    expect(plan.targetStop.predictedEpochSec).toBe(1_480);
    expect(plan.nextStop.name).toBe("After");
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
        targetPassedConfirmed: true,
      }).stage
    ).toBe(RIDE_STAGE.MISSED);
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
});
