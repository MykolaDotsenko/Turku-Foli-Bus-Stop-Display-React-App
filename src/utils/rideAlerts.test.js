import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  rideAlertCapabilities,
  showRideNotification,
  vibrateRideStage,
} from "./rideAlerts";

describe("ride alerts", () => {
  const originalVibrate = navigator.vibrate;

  beforeEach(() => {
    Object.defineProperty(navigator, "vibrate", {
      configurable: true,
      value: vi.fn(() => true),
    });
  });

  afterEach(() => {
    Object.defineProperty(navigator, "vibrate", {
      configurable: true,
      value: originalVibrate,
    });
  });

  it("uses escalating haptic patterns", () => {
    expect(vibrateRideStage("soon")).toBe(true);
    expect(vibrateRideStage("now")).toBe(true);

    expect(navigator.vibrate.mock.calls[0][0]).toEqual([120]);
    expect(navigator.vibrate.mock.calls[1][0].length).toBeGreaterThan(1);
  });

  it("reports browser capabilities without throwing", () => {
    const capabilities = rideAlertCapabilities();
    expect(capabilities).toHaveProperty("audio");
    expect(capabilities).toHaveProperty("vibration");
    expect(capabilities).toHaveProperty("speech");
    expect(capabilities).toHaveProperty("notifications");
    expect(capabilities).toHaveProperty("wakeLock");
  });
});

describe("ride get-off notifications", () => {
  let created = [];

  class FakeNotification {
    constructor(title, options) {
      this.title = title;
      this.options = options;
      this.onclick = null;
      this.close = vi.fn();
      created.push(this);
    }
  }

  beforeEach(() => {
    created = [];
    FakeNotification.permission = "granted";
    vi.stubGlobal("Notification", FakeNotification);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete navigator.serviceWorker;
  });

  function stubServiceWorker(registration) {
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { getRegistration: () => Promise.resolve(registration) },
    });
  }

  it("stays silent when permission was never granted", async () => {
    FakeNotification.permission = "default";

    await expect(showRideNotification("now", "Puistokatu")).resolves.toBe(
      false
    );
    expect(created).toHaveLength(0);
  });

  // The phone is locked and the page is backgrounded when it matters most,
  // which is exactly when only a service-worker notification survives.
  it("prefers the service worker and makes the get-off alert unmissable", async () => {
    const showNotification = vi.fn(() => Promise.resolve());
    stubServiceWorker({ showNotification });

    await expect(showRideNotification("now", "Puistokatu")).resolves.toBe(true);
    expect(created).toHaveLength(0);

    const [title, options] = showNotification.mock.calls[0];
    expect(title).toBe("This is your stop: Puistokatu");
    expect(options.requireInteraction).toBe(true);
    expect(options.renotify).toBe(true);
    expect(options.tag).toBe("foli-active-ride");
  });

  it("sends a tap on the page-level fallback back to the app", async () => {
    stubServiceWorker(null);
    const focus = vi.fn();
    vi.stubGlobal("focus", focus);
    vi.stubGlobal("Notification", FakeNotification);

    await expect(showRideNotification("now", "Puistokatu")).resolves.toBe(true);
    expect(created).toHaveLength(1);

    expect(typeof created[0].onclick).toBe("function");
    created[0].onclick();
    expect(focus).toHaveBeenCalledTimes(1);
    expect(created[0].close).toHaveBeenCalledTimes(1);
  });
});
