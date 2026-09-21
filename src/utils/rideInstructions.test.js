import { describe, expect, it } from "vitest";
import { rideExitInstruction } from "./rideInstructions";

describe("Ride Mode exit instructions", () => {
  it("asks for a stop request on bus-like GTFS modes", () => {
    expect(rideExitInstruction(3)).toEqual(
      expect.objectContaining({
        kind: "request-stop",
        nextText: "Press the STOP button now.",
      })
    );
  });

  it("uses conservative generic wording for waterbus and unknown modes", () => {
    expect(rideExitInstruction(4).kind).toBe("prepare-exit");
    expect(rideExitInstruction(null).kind).toBe("prepare-exit");
    expect(rideExitInstruction(99).nextText).toBe(
      "Get ready to exit at the next stop."
    );
  });
});
