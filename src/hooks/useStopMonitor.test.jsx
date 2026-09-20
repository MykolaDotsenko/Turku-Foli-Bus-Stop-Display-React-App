import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import { fetchStopMonitor } from "../api/foliApi";
import useStopMonitor, { pollDelayMs } from "./useStopMonitor";

vi.mock("../api/foliApi", () => ({
  fetchStopMonitor: vi.fn(),
}));

function Harness({ stopId }) {
  const { stopName, error, receivedAtMs, refresh } = useStopMonitor(stopId);

  return (
    <div>
      <span>{stopName}</span>
      <span data-testid="error">{String(error)}</span>
      <span data-testid="received-at">{String(receivedAtMs)}</span>
      <button type="button" onClick={() => refresh()}>
        Refresh
      </button>
    </div>
  );
}

beforeEach(() => {
  vi.mocked(fetchStopMonitor).mockReset();
});

test("never renders previous-stop data under a new stop ID", async () => {
  let resolveSecondRequest;

  vi.mocked(fetchStopMonitor)
    .mockResolvedValueOnce({
      stopName: "Kauppatori",
      arrivals: [{ lineref: "1" }],
      serverTime: 100,
    })
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSecondRequest = resolve;
        })
    );

  const { rerender } = render(<Harness stopId="164" />);

  expect(await screen.findByText("Kauppatori")).toBeInTheDocument();

  rerender(<Harness stopId="32" />);

  expect(screen.queryByText("Kauppatori")).not.toBeInTheDocument();

  resolveSecondRequest({
    stopName: "New stop",
    arrivals: [],
    serverTime: 200,
  });

  expect(await screen.findByText("New stop")).toBeInTheDocument();
});

test("keeps same-stop data when a refresh temporarily fails", async () => {
  vi.mocked(fetchStopMonitor)
    .mockResolvedValueOnce({
      stopName: "Kauppatori",
      arrivals: [{ lineref: "1" }],
      serverTime: 100,
    })
    .mockRejectedValueOnce(new Error("temporary outage"));

  render(<Harness stopId="164" />);

  expect(await screen.findByText("Kauppatori")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Refresh" }));

  await waitFor(() => {
    expect(screen.getByTestId("error")).toHaveTextContent("true");
  });

  expect(screen.getByText("Kauppatori")).toBeInTheDocument();
});


test("records when the last successful realtime payload was received", async () => {
  vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
  vi.mocked(fetchStopMonitor).mockResolvedValueOnce({
    stopName: "Kauppatori",
    arrivals: [],
    serverTime: 1_700_000_000,
  });

  render(<Harness stopId="164" />);

  expect(await screen.findByText("Kauppatori")).toBeInTheDocument();
  expect(screen.getByTestId("received-at")).toHaveTextContent(
    "1700000000000"
  );
});


test("backs off repeated automatic retries without exceeding five minutes", () => {
  expect(pollDelayMs(0)).toBe(30_000);
  expect(pollDelayMs(1)).toBe(30_000);
  expect(pollDelayMs(2)).toBe(60_000);
  expect(pollDelayMs(3)).toBe(120_000);
  expect(pollDelayMs(4)).toBe(240_000);
  expect(pollDelayMs(5)).toBe(300_000);
  expect(pollDelayMs(20)).toBe(300_000);
});

test("refreshes on foreground return but not while hidden, and cleans up the listener", async () => {
  let visibility = "hidden";
  const visibilitySpy = vi
    .spyOn(document, "visibilityState", "get")
    .mockImplementation(() => visibility);

  vi.mocked(fetchStopMonitor).mockResolvedValue({
    stopName: "Kauppatori",
    arrivals: [],
    serverTime: 100,
  });

  const { unmount } = render(<Harness stopId="164" />);
  expect(await screen.findByText("Kauppatori")).toBeInTheDocument();
  expect(fetchStopMonitor).toHaveBeenCalledTimes(1);

  fireEvent(document, new globalThis.Event("visibilitychange"));
  await Promise.resolve();
  expect(fetchStopMonitor).toHaveBeenCalledTimes(1);

  visibility = "visible";
  fireEvent(document, new globalThis.Event("visibilitychange"));
  await waitFor(() => {
    expect(fetchStopMonitor).toHaveBeenCalledTimes(2);
  });

  unmount();
  fireEvent(document, new globalThis.Event("visibilitychange"));
  await Promise.resolve();
  expect(fetchStopMonitor).toHaveBeenCalledTimes(2);

  visibilitySpy.mockRestore();
});
