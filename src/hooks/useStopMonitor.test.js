import { fireEvent, render, screen, waitFor } from "@testing-library/react";\nimport { beforeEach, expect, test, vi } from "vitest";
import { fetchStopMonitor } from "../api/foliApi";
import useStopMonitor from "./useStopMonitor";

jest.mock("../api/foliApi", () => ({
  fetchStopMonitor: jest.fn(),
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
  fetchStopMonitor.mockReset();
});

test("clears previous stop data immediately when the stop changes", async () => {
  fetchStopMonitor
    .mockResolvedValueOnce({
      stopName: "Kauppatori",
      arrivals: [{ lineref: "1" }],
      serverTime: 100,
    })
    .mockImplementationOnce(() => new Promise(() => {}));

  const { rerender } = render(<Harness stopId="164" />);

  expect(await screen.findByText("Kauppatori")).toBeInTheDocument();

  rerender(<Harness stopId="32" />);

  await waitFor(() => {
    expect(screen.queryByText("Kauppatori")).not.toBeInTheDocument();
  });
});

test("keeps same-stop data when a refresh temporarily fails", async () => {
  fetchStopMonitor
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
