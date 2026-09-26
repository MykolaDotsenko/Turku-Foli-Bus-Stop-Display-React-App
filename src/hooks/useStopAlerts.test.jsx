import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchAlerts: vi.fn(),
  fetchStopServedRouteIds: vi.fn(),
}));

vi.mock("../api/foliApi", () => ({
  fetchAlerts: mocks.fetchAlerts,
  fetchStopServedRouteIds: mocks.fetchStopServedRouteIds,
}));

import useStopAlerts from "./useStopAlerts";

const routesById = new Map([["50", { id: "50", shortName: "50" }]]);
const noLines = [];

beforeEach(() => {
  mocks.fetchAlerts.mockReset();
  mocks.fetchStopServedRouteIds.mockReset();
  mocks.fetchAlerts.mockResolvedValue({
    messages: [
      {
        message_id: 50,
        isactive: true,
        priority: 500,
        affected_routes: ["50"],
        affected_stops: [],
        header: "Line 50 stop moved",
      },
    ],
  });
});

// The routes found to serve one stop were kept while the next stop's lookup
// ran, so a line-50 notice stayed on screen under a stop line 50 never
// serves: data from one stop shown under another.
test("never shows the previous stop's route notices under a new stop", async () => {
  mocks.fetchStopServedRouteIds.mockImplementation((stopId) =>
    stopId === "164" ? Promise.resolve(new Set(["50"])) : new Promise(() => {})
  );

  const { result, rerender } = renderHook(
    ({ stopId }) => useStopAlerts(stopId, noLines, routesById),
    { initialProps: { stopId: "164" } }
  );

  await waitFor(() =>
    expect(result.current.alerts.map((alert) => alert.title)).toEqual([
      "Line 50 stop moved",
    ])
  );

  rerender({ stopId: "32" });

  expect(result.current.alerts).toEqual([]);
});

test("shows a route notice once the new stop is confirmed to be on that route", async () => {
  mocks.fetchStopServedRouteIds.mockResolvedValue(new Set(["50"]));

  const { result } = renderHook(() =>
    useStopAlerts("32", noLines, routesById)
  );

  await waitFor(() =>
    expect(result.current.alerts.map((alert) => alert.title)).toEqual([
      "Line 50 stop moved",
    ])
  );
});
