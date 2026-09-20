import { expect, test } from "vitest";
import { extractStopAlerts } from "./alerts";

const routesById = new Map([
  [
    "1",
    {
      id: "1",
      shortName: "1",
      longName: "Satama–Kauppatori–Lentoasema",
    },
  ],
  [
    "2",
    {
      id: "2",
      shortName: "1A",
      longName: "Satama–Kauppatori–Lentoasema",
    },
  ],
]);

test("returns active stop-specific alerts", () => {
  const result = extractStopAlerts(
    {
      global_message: {},
      emergency_message: {},
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
    { stopId: "164", lineRefs: [], routesById }
  );

  expect(result).toEqual([
    expect.objectContaining({
      type: "message",
      title: "Detour",
      message: "Use the temporary stop.",
    }),
  ]);
});

test("includes route-only disruptions for lines currently serving the stop", () => {
  const result = extractStopAlerts(
    {
      messages: [
        {
          message_id: 217294,
          isactive: true,
          priority: 900,
          effect: "DETOUR",
          affected_stops: [],
          affected_routes: ["1", "2"],
          header: "Lines 1 and 1A on a detour",
          message: "Temporary route in the city centre.",
          information: "Stop 14 is not in use.",
        },
      ],
    },
    { stopId: "164", lineRefs: ["1"], routesById }
  );

  expect(result).toEqual([
    expect.objectContaining({
      type: "message",
      effectLabel: "Detour",
      routeNames: ["1", "1A"],
      information: "Stop 14 is not in use.",
    }),
  ]);
});

test("does not show a route-only alert for unrelated active lines", () => {
  const result = extractStopAlerts(
    {
      messages: [
        {
          isactive: true,
          affected_routes: ["1"],
          affected_stops: [],
          header: "Line 1 detour",
        },
      ],
    },
    { stopId: "164", lineRefs: ["8"], routesById }
  );

  expect(result).toEqual([]);
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
          cause: "TECHNICAL_PROBLEM",
          stops: [
            { stop: "164", arrival: 1900000000, isactive: true },
          ],
        },
      ],
    },
    { stopId: "164", lineRefs: ["1"], routesById }
  );

  expect(result[0]).toEqual(
    expect.objectContaining({
      type: "cancellation",
      line: "1",
      cause: "TECHNICAL_PROBLEM",
    })
  );
});

test("includes a non-empty global message but ignores empty envelopes", () => {
  expect(
    extractStopAlerts(
      { global_message: {}, emergency_message: {}, messages: [] },
      { stopId: "164", lineRefs: [], routesById }
    )
  ).toEqual([]);

  const result = extractStopAlerts(
    {
      global_message: {
        header: "Network-wide notice",
        message: "Expect unusually high demand today.",
      },
    },
    { stopId: "164", lineRefs: [], routesById }
  );

  expect(result[0]).toEqual(
    expect.objectContaining({
      type: "global",
      title: "Network-wide notice",
    })
  );
});

test("an emergency message replaces all other alert content", () => {
  const result = extractStopAlerts(
    {
      emergency_message: {
        header: "Emergency notice",
        message: "Follow Föli staff instructions.",
      },
      global_message: {
        message: "General message",
      },
      messages: [
        {
          isactive: true,
          affected_stops: ["164"],
          message: "Ordinary disruption",
        },
      ],
    },
    { stopId: "164", lineRefs: ["1"], routesById }
  );

  expect(result).toEqual([
    expect.objectContaining({
      type: "emergency",
      title: "Emergency notice",
      message: "Follow Föli staff instructions.",
    }),
  ]);
});
