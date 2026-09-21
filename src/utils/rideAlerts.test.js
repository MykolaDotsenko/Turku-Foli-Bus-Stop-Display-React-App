import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  rideAlertCapabilities,
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
