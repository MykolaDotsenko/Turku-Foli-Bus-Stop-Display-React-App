import { describe, expect, it } from "vitest";
import {
  gtfsServiceEpoch,
  mergeRealtimeAndScheduled,
  scheduledClockCandidates,
  serviceDateKey,
  serviceRunsOnDate,
} from "./gtfsSchedule";

describe("GTFS scheduled departure helpers", () => {
  it("converts a Turku service date and clock into the correct epoch", () => {
    // 2026-09-21 15:20 in Helsinki is 12:20 UTC (EEST).
    expect(gtfsServiceEpoch("20260921", "15:20:00")).toBe(
      Date.parse("2026-09-21T12:20:00Z") / 1000
    );
  });

  it("keeps GTFS times beyond 24:00 on the originating service date", () => {
    expect(gtfsServiceEpoch("20260921", "24:10:00")).toBe(
      Date.parse("2026-09-21T21:10:00Z") / 1000
    );
  });

  it("derives service dates in Europe/Helsinki instead of the device timezone", () => {
    expect(
      serviceDateKey(Date.parse("2026-09-20T21:30:00Z") / 1000)
    ).toBe("20260921");
  });

  it("accepts Föli's historical active exception type and standard GTFS adds", () => {
    const calendarDates = {
      weekday: [
        { date: "20260921", exceptionType: 0 },
        { date: "20260922", exceptionType: 1 },
      ],
      removed: [{ date: "20260921", exceptionType: 2 }],
    };

    expect(serviceRunsOnDate(calendarDates, "weekday", "20260921")).toBe(true);
    expect(serviceRunsOnDate(calendarDates, "weekday", "20260922")).toBe(true);
    expect(serviceRunsOnDate(calendarDates, "removed", "20260921")).toBe(false);
    expect(serviceRunsOnDate(calendarDates, "missing", "20260921")).toBe(false);
  });

  it("finds timetable rows around now across midnight", () => {
    const reference = Date.parse("2026-09-21T20:55:00Z") / 1000; // 23:55 Helsinki
    const candidates = scheduledClockCandidates(
      [
        {
          tripId: "late",
          arrivalTime: "24:10:00",
          departureTime: "24:10:00",
          pickupType: 0,
        },
        {
          tripId: "tomorrow",
          arrivalTime: "00:20:00",
          departureTime: "00:20:00",
          pickupType: 0,
        },
      ],
      reference,
      { lookaheadSeconds: 60 * 60 }
    );

    expect(candidates.map((item) => item.tripId)).toEqual([
      "late",
      "tomorrow",
    ]);
    expect(candidates[0].serviceDate).toBe("20260921");
    expect(candidates[1].serviceDate).toBe("20260922");
  });

  it("excludes drop-off-only and far-away timetable rows", () => {
    const reference = Date.parse("2026-09-21T12:15:00Z") / 1000;
    const candidates = scheduledClockCandidates(
      [
        {
          tripId: "boardable",
          departureTime: "15:20:00",
          pickupType: 0,
        },
        {
          tripId: "dropoff-only",
          departureTime: "15:21:00",
          pickupType: 1,
        },
        {
          tripId: "too-late",
          departureTime: "22:00:00",
          pickupType: 0,
        },
      ],
      reference
    );

    expect(candidates.map((item) => item.tripId)).toEqual(["boardable"]);
  });

  it("lets a realtime row replace its scheduled copy", () => {
    const realtime = [
      {
        tripref: "trip-32",
        lineref: "32",
        monitored: true,
        aimeddeparturetime: 1000,
        expecteddeparturetime: 1040,
      },
    ];
    const scheduled = [
      {
        tripref: "trip-32",
        lineref: "32",
        monitored: false,
        aimeddeparturetime: 1000,
      },
      {
        tripref: "trip-99",
        lineref: "99",
        monitored: false,
        aimeddeparturetime: 1100,
      },
    ];

    expect(
      mergeRealtimeAndScheduled(realtime, scheduled).map((row) => [
        row.tripref,
        row.monitored,
      ])
    ).toEqual([
      ["trip-32", true],
      ["trip-99", false],
    ]);
  });

  it("deduplicates by line and aimed time when SIRI omits the trip reference", () => {
    const realtime = [
      {
        tripref: "",
        lineref: "32",
        aimeddeparturetime: 1000,
      },
    ];
    const scheduled = [
      {
        tripref: "static-trip",
        lineref: "32",
        aimeddeparturetime: 1080,
      },
    ];

    expect(mergeRealtimeAndScheduled(realtime, scheduled)).toHaveLength(1);
  });
});
