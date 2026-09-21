import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import BusStopForm from "./BusStopForm";

const stops = [
  { id: "164", name: "Kauppatori" },
  { id: "4", name: "Turun linna" },
  { id: "32", name: "Puistokatu" },
];


test("starts with an empty field when no stop is selected", () => {
  render(<BusStopForm activeStopId="" stops={stops} onSubmit={vi.fn()} />);

  expect(
    screen.getByRole("combobox", { name: "Find your stop" })
  ).toHaveValue("");
});

test("location button fills the nearest stop but waits for explicit submit", async () => {
  const originalGeolocation = navigator.geolocation;
  const onSubmit = vi.fn();
  const stopsWithCoordinates = [
    { id: "164", name: "Kauppatori", lat: 60.4518, lon: 22.2666 },
    { id: "4", name: "Turun linna", lat: 60.4355, lon: 22.2345 },
  ];

  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: {
      getCurrentPosition: (success) =>
        success({
          coords: {
            latitude: 60.45182,
            longitude: 22.26662,
            accuracy: 12,
          },
        }),
    },
  });

  try {
    render(
      <BusStopForm
        activeStopId=""
        stops={stopsWithCoordinates}
        coordinatesStatus="ready"
        onSubmit={onSubmit}
      />
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Use current location",
      })
    );

    const input = screen.getByRole("combobox", { name: "Find your stop" });
    await waitFor(() => expect(input).toHaveValue("Kauppatori"));
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Show departures" }));
    expect(onSubmit).toHaveBeenCalledWith("164");
  } finally {
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: originalGeolocation,
    });
  }
});

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


test("does not silently choose between stops with the same name", () => {
  const onSubmit = vi.fn();
  const duplicateStops = [
    { id: "100", name: "Market" },
    { id: "101", name: "Market" },
  ];

  render(
    <BusStopForm
      activeStopId="164"
      stops={duplicateStops}
      onSubmit={onSubmit}
    />
  );

  const input = screen.getByRole("combobox", { name: "Find your stop" });
  fireEvent.change(input, { target: { value: "Market" } });
  fireEvent.click(screen.getByRole("button", { name: "Show departures" }));

  expect(onSubmit).not.toHaveBeenCalled();
  expect(
    screen.getByText(/More than one stop has this name/i)
  ).toBeInTheDocument();
  expect(screen.getAllByRole("option")).toHaveLength(2);
});

// The field takes a name or a number equally, so it should hand back
// whichever one the person thinks in. It used to answer every entry with the
// number: type "Kauppatori", get "164".
test("keeps the stop name in the field instead of swapping it for a number", () => {
  render(<BusStopForm activeStopId="164" stops={stops} onSubmit={vi.fn()} />);

  const input = screen.getByRole("combobox", { name: "Find your stop" });
  expect(input).toHaveValue("Kauppatori");

  fireEvent.change(input, { target: { value: "Turun" } });
  fireEvent.focus(input);
  fireEvent.click(screen.getByRole("option", { name: /Turun linna/i }));

  expect(input).toHaveValue("Turun linna");
});

test("a stop number typed in comes back as that stop's name", () => {
  const onSubmit = vi.fn();
  render(<BusStopForm activeStopId="164" stops={stops} onSubmit={onSubmit} />);

  const input = screen.getByRole("combobox", { name: "Find your stop" });
  fireEvent.change(input, { target: { value: "32" } });
  fireEvent.submit(input.closest("form"));

  expect(onSubmit).toHaveBeenCalledWith("32");
});

// With the name showing, pressing Show again has to mean the same stop —
// not send the text back through a name lookup that two stops could match.
test("re-submitting a resolved name reopens that exact stop", () => {
  const twins = [
    { id: "164", name: "Kauppatori" },
    { id: "999", name: "Kauppatori" },
  ];
  const onSubmit = vi.fn();

  render(<BusStopForm activeStopId="999" stops={twins} onSubmit={onSubmit} />);

  const input = screen.getByRole("combobox", { name: "Find your stop" });
  expect(input).toHaveValue("Kauppatori");

  fireEvent.submit(input.closest("form"));

  expect(onSubmit).toHaveBeenCalledWith("999");
  expect(screen.queryByText(/More than one stop/i)).not.toBeInTheDocument();
});

test("still refuses to guess when a freshly typed name is ambiguous", () => {
  const twins = [
    { id: "164", name: "Kauppatori" },
    { id: "999", name: "Kauppatori" },
  ];
  const onSubmit = vi.fn();

  render(<BusStopForm activeStopId="4" stops={[...twins, { id: "4", name: "Turun linna" }]} onSubmit={onSubmit} />);

  const input = screen.getByRole("combobox", { name: "Find your stop" });
  fireEvent.change(input, { target: { value: "Kauppatori" } });
  fireEvent.submit(input.closest("form"));

  expect(onSubmit).not.toHaveBeenCalled();
  expect(screen.getByText(/More than one stop/i)).toBeInTheDocument();
});
