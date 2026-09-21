import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import DemoTour from "./DemoTour";

test("walks through the Turku demo and opens the real Kauppatori stop", () => {
  const onClose = vi.fn();
  const onOpenKauppatori = vi.fn();

  render(
    <DemoTour
      open
      onClose={onClose}
      onOpenKauppatori={onOpenKauppatori}
    />
  );

  expect(
    screen.getByRole("heading", { name: "Know what leaves next" })
  ).toBeInTheDocument();

  for (let index = 0; index < 4; index += 1) {
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
  }

  expect(
    screen.getByRole("heading", {
      name: "Open Kauppatori with live Föli data",
    })
  ).toBeInTheDocument();

  fireEvent.click(
    screen.getByRole("button", { name: "Open Kauppatori" })
  );

  expect(onClose).toHaveBeenCalledTimes(1);
  expect(onOpenKauppatori).toHaveBeenCalledTimes(1);
});

test("closes the demo with Escape", () => {
  const onClose = vi.fn();

  render(
    <DemoTour
      open
      onClose={onClose}
      onOpenKauppatori={() => {}}
    />
  );

  fireEvent.keyDown(
    screen.getByRole("dialog", { name: "Know what leaves next" }),
    { key: "Escape" }
  );

  expect(onClose).toHaveBeenCalledTimes(1);
});

test("supports arrow-key navigation without skipping beyond the tour", () => {
  render(
    <DemoTour
      open
      onClose={() => {}}
      onOpenKauppatori={() => {}}
    />
  );

  const dialog = screen.getByRole("dialog", { name: "Know what leaves next" });

  fireEvent.keyDown(dialog, { key: "ArrowRight" });

  expect(
    screen.getByRole("heading", {
      name: "See what is live — and what is scheduled",
    })
  ).toBeInTheDocument();

  fireEvent.keyDown(
    screen.getByRole("dialog", {
      name: "See what is live — and what is scheduled",
    }),
    { key: "ArrowLeft" }
  );

  expect(
    screen.getByRole("heading", { name: "Know what leaves next" })
  ).toBeInTheDocument();
});
