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

  it("uses generic wording for a waterbus and other modes known not to be buses", () => {
    expect(rideExitInstruction(4).kind).toBe("prepare-exit");
    expect(rideExitInstruction(0).kind).toBe("prepare-exit");
    expect(rideExitInstruction(99).nextText).toBe(
      "Get ready to exit at the next stop."
    );
  });

  // Trip details that failed on a weak connection left the type unknown,
  // and a bus ride went without its "Press STOP".
  it("treats a type it does not know as a bus, as nearly every Föli trip is", () => {
    expect(rideExitInstruction(null).kind).toBe("request-stop");
    expect(rideExitInstruction(undefined).kind).toBe("request-stop");
    expect(rideExitInstruction(704).kind).toBe("request-stop");
    expect(rideExitInstruction(200).kind).toBe("request-stop");
  });
});
