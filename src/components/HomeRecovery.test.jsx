import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
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

const originalPrint = Object.getOwnPropertyDescriptor(globalThis, "print");

afterEach(() => {
  vi.restoreAllMocks();

  if (originalPrint) {
    Object.defineProperty(globalThis, "print", originalPrint);
  } else {
    delete globalThis.print;
  }
});

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
      name: "Need help getting home?",
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
  expect(
    screen.getByText(/Google Maps.*saved Home stop.*does not verify/i)
  ).toBeInTheDocument();
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
    screen.getByText("Other saved Home stop")
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


test("does not send a stressed user into external routing while offline", () => {
  const onOpenStop = vi.fn();

  render(
    <HomeRecovery
      home={home}
      stops={stops}
      online={false}
      onOpenStop={onOpenStop}
    />
  );

  expect(
    screen.getByRole("button", { name: "Get me Home" })
  ).toBeDisabled();
  expect(
    screen.getByText(/You’re offline.*driver card still work/i)
  ).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Open Home stop" }));
  expect(onOpenStop).toHaveBeenCalledWith("164");

  fireEvent.click(screen.getByRole("button", { name: "Show driver" }));
  expect(screen.getByRole("dialog")).toBeInTheDocument();
});


test("can print a public-stop-only Home backup card before the phone dies", () => {
  const print = vi.fn();
  Object.defineProperty(globalThis, "print", {
    configurable: true,
    value: print,
  });

  render(<HomeRecovery home={home} stops={stops} onOpenStop={vi.fn()} />);

  fireEvent.click(screen.getByText("Prepare for no battery"));
  expect(
    screen.getByText(/A web app cannot help after the phone powers off/i)
  ).toBeInTheDocument();

  fireEvent.click(
    screen.getByRole("button", { name: "Print / save Home backup card" })
  );

  expect(print).toHaveBeenCalledTimes(1);
  expect(screen.getByText("Föli Home backup card")).toBeInTheDocument();
  expect(screen.getAllByText("Kauppatori").length).toBeGreaterThan(0);
  expect(screen.getAllByText(/Stop 164/).length).toBeGreaterThan(0);
  expect(screen.queryByText("60.4518")).not.toBeInTheDocument();
  expect(screen.queryByText("22.2666")).not.toBeInTheDocument();
});
