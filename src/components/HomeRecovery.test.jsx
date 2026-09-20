import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import HomeRecovery from "./HomeRecovery";

const home = {
  id: "home",
  label: "Home",
  icon: "⌂",
  primaryStopId: "164",
  stops: [
    { id: "164", name: "Kauppatori" },
    { id: "32", name: "Puistokatu" },
  ],
};

const stops = [
  { id: "164", name: "Kauppatori", lat: 60.4518, lon: 22.2666 },
  { id: "32", name: "Puistokatu", lat: 60.4488, lon: 22.255 },
];

test("does not render recovery before Home has been configured", () => {
  const { container } = render(
    <HomeRecovery home={null} stops={stops} onOpenStop={vi.fn()} />
  );

  expect(container).toBeEmptyDOMElement();
});

test("offers one-tap transit recovery without embedding the current origin", () => {
  render(<HomeRecovery home={home} stops={stops} onOpenStop={vi.fn()} />);

  expect(
    screen.getByRole("heading", {
      name: "Lost or unsure? Get home from here.",
    })
  ).toBeInTheDocument();
  expect(
    screen.getByText(/travel help, not an emergency service/i)
  ).toBeInTheDocument();

  const getHome = screen.getByRole("link", {
    name: "Get me Home by public transit",
  });
  const url = new globalThis.URL(getHome.href);

  expect(url.searchParams.get("destination")).toBe("60.4518,22.2666");
  expect(url.searchParams.get("travelmode")).toBe("transit");
  expect(url.searchParams.has("origin")).toBe(false);
});

test("keeps useful fallbacks when route coordinates are unavailable", () => {
  const onOpenStop = vi.fn();

  render(
    <HomeRecovery
      home={home}
      stops={[
        { id: "164", name: "Kauppatori" },
        { id: "32", name: "Puistokatu" },
      ]}
      onOpenStop={onOpenStop}
    />
  );

  expect(
    screen.getByRole("button", { name: "Get me Home" })
  ).toBeDisabled();
  expect(
    screen.getByText(/Transit directions are temporarily unavailable/i)
  ).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Open Home stop" }));
  expect(onOpenStop).toHaveBeenCalledWith("164");

  fireEvent.click(screen.getByRole("button", { name: "Show driver" }));
  const dialog = screen.getByRole("dialog");
  expect(
    within(dialog).getByRole("heading", { name: "I need to get to Home" })
  ).toBeInTheDocument();
  expect(within(dialog).getByText("Kauppatori")).toBeInTheDocument();
  expect(within(dialog).getByText("Stop 164")).toBeInTheDocument();
});

test("exposes saved backup stops only on demand", () => {
  const onOpenStop = vi.fn();

  render(<HomeRecovery home={home} stops={stops} onOpenStop={onOpenStop} />);

  fireEvent.click(
    screen.getByText("Other safe Home stop")
  );

  const backupRoute = screen.getByRole("link", {
    name: "Get to backup Home stop Puistokatu, stop 32, by public transit",
  });
  const backupUrl = new globalThis.URL(backupRoute.href);
  expect(backupUrl.searchParams.get("destination")).toBe("60.4488,22.255");
  expect(backupUrl.searchParams.has("origin")).toBe(false);

  fireEvent.click(screen.getByRole("button", { name: "Open stop" }));
  expect(onOpenStop).toHaveBeenCalledWith("32");
});
