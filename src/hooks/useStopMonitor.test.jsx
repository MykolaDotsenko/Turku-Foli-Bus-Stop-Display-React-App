import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import { fetchStopMonitor } from "../api/foliApi";
import useStopMonitor from "./useStopMonitor";

vi.mock("../api/foliApi", () => ({
  fetchStopMonitor: vi.fn(),
}));

function Harness({ stopId }) {
  const { stopName, error, refresh } = useStopMonitor(stopId);

  return (
    <div>
      <span>{stopName}</span>
      <span data-testid="error">{String(error)}</span>
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
