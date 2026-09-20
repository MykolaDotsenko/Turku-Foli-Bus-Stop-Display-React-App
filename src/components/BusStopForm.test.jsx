import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import BusStopForm from "./BusStopForm";

const stops = [
  { id: "164", name: "Kauppatori" },
  { id: "4", name: "Turun linna" },
  { id: "32", name: "Puistokatu" },
];

test("finds stops by name and submits a suggestion", () => {
  const onSubmit = vi.fn();

  render(
    <BusStopForm activeStopId="164" stops={stops} onSubmit={onSubmit} />
  );

  const input = screen.getByRole("combobox", { name: "Find your stop" });
  fireEvent.change(input, { target: { value: "Turun" } });
  fireEvent.focus(input);

  fireEvent.click(screen.getByRole("option", { name: /Turun linna/i }));

  expect(onSubmit).toHaveBeenCalledWith("4");
});

test("supports arrow-key selection", () => {
  const onSubmit = vi.fn();

  render(
    <BusStopForm activeStopId="164" stops={stops} onSubmit={onSubmit} />
  );

  const input = screen.getByRole("combobox", { name: "Find your stop" });
  fireEvent.change(input, { target: { value: "Puisto" } });
  fireEvent.focus(input);
  fireEvent.keyDown(input, { key: "ArrowDown" });
  fireEvent.keyDown(input, { key: "Enter" });

  expect(onSubmit).toHaveBeenCalledWith("32");
});

test("accepts a numeric stop directly", () => {
  const onSubmit = vi.fn();

  render(
    <BusStopForm activeStopId="164" stops={stops} onSubmit={onSubmit} />
  );

  const input = screen.getByRole("combobox", { name: "Find your stop" });
  fireEvent.change(input, { target: { value: "32" } });
  fireEvent.click(screen.getByRole("button", { name: "Show departures" }));

  expect(onSubmit).toHaveBeenCalledWith("32");
});


test("accepts a unique partial name without forcing an extra tap", () => {
  const onSubmit = vi.fn();

  render(
    <BusStopForm activeStopId="164" stops={stops} onSubmit={onSubmit} />
  );

  const input = screen.getByRole("combobox", { name: "Find your stop" });
  fireEvent.change(input, { target: { value: "Puisto" } });
  fireEvent.click(screen.getByRole("button", { name: "Show departures" }));

  expect(onSubmit).toHaveBeenCalledWith("32");
});

test("matches stop names without requiring Finnish diacritics", () => {
  const onSubmit = vi.fn();
  const localStops = [{ id: "9", name: "Mäntymäki" }];

  render(
    <BusStopForm activeStopId="164" stops={localStops} onSubmit={onSubmit} />
  );

  const input = screen.getByRole("combobox", { name: "Find your stop" });
  fireEvent.change(input, { target: { value: "Mantymaki" } });
  fireEvent.click(screen.getByRole("button", { name: "Show departures" }));

  expect(onSubmit).toHaveBeenCalledWith("9");
});
