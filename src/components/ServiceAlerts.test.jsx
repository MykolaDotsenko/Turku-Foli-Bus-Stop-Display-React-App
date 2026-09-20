import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import ServiceAlerts from "./ServiceAlerts";

function message(id) {
  return {
    id: `message-${id}`,
    type: "message",
    title: `Update ${id}`,
    message: `Message ${id}`,
    information: "",
    effect: "DETOUR",
    effectLabel: "Detour",
    routeNames: ["1"],
  };
}

test("does not silently hide service updates beyond the first four", () => {
  render(
    <ServiceAlerts
      alerts={[1, 2, 3, 4, 5, 6].map(message)}
    />
  );

  expect(screen.getByText("Update 1")).toBeInTheDocument();
  expect(screen.getByText("Update 4")).toBeInTheDocument();
  expect(screen.queryByText("Update 5")).not.toBeInTheDocument();

  const more = screen.getByRole("button", {
    name: "Show 2 more updates",
  });
  expect(more).toHaveAttribute("aria-expanded", "false");

  fireEvent.click(more);

  expect(screen.getByText("Update 5")).toBeInTheDocument();
  expect(screen.getByText("Update 6")).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Show fewer updates" })
  ).toHaveAttribute("aria-expanded", "true");
});


test("does not imply there are no disruptions when the alert feed cannot be confirmed", () => {
  render(<ServiceAlerts alerts={[]} error />);

  expect(
    screen.getByRole("heading", { name: "Service update check unavailable" })
  ).toBeInTheDocument();
  expect(
    screen.getByText(/Föli disruption data could not be confirmed/i)
  ).toBeInTheDocument();
});

test("marks retained disruption data when the last successful check is old", () => {
  render(
    <ServiceAlerts
      alerts={[message(1)]}
      receivedAtMs={Date.now() - 11 * 60 * 1000}
    />
  );

  expect(
    screen.getByText(/Service update check is getting old.*11 min ago/i)
  ).toBeInTheDocument();
  expect(screen.getByText("Update 1")).toBeInTheDocument();
});
