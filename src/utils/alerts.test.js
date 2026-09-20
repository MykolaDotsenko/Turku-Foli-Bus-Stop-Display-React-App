import { expect, test } from "vitest";
import { extractStopAlerts } from "./alerts";

test("returns only active alerts that affect the current stop", () => {
  const result = extractStopAlerts(
    {
      messages: [
        {
          id: 1,
          isactive: true,
          priority: 50,
          affected_stops: ["164"],
          header: "Detour",
          message: "Use the temporary stop.",
        },
        {
          id: 2,
          isactive: true,
          priority: 10,
          affected_stops: ["32"],
          header: "Other stop",
        },
        {
          id: 3,
          isactive: false,
          affected_stops: ["164"],
          header: "Expired",
        },
      ],
    },
    "164"
  );

  expect(result).toEqual([
    expect.objectContaining({
      type: "message",
      title: "Detour",
      message: "Use the temporary stop.",
    }),
  ]);
});

test("puts active cancellations before service messages", () => {
  const result = extractStopAlerts(
    {
      messages: [
        {
          isactive: true,
          priority: 1,
          affected_stops: ["164"],
          header: "General update",
        },
      ],
      cancellations: [
        {
          id: "c1",
          line: "1",
          cause: "Vehicle issue",
          stops: [
            { stop: "164", arrival: 1900000000, isactive: true },
          ],
        },
      ],
    },
    "164"
  );

  expect(result[0]).toEqual(
    expect.objectContaining({
      type: "cancellation",
      line: "1",
      cause: "Vehicle issue",
    })
  );
});
