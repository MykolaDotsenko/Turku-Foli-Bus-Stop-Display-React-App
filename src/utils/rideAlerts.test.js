import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  announceRideStage,
  playRideTone,
  rideAlertCapabilities,
  repeatNowRideSignal,
  runRideTestAlert,
  showRideNotification,
  speakRideStage,
  stopRideAlerts,
  unlockRideAudio,
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
    // A raster icon every notification centre decodes, and a status-bar badge
    // so Android shows the bus rather than the browser's logo.
    expect(options.icon).toMatch(/\/icon-192\.png$/);
    expect(options.badge).toMatch(/\/notification-badge-96\.png$/);
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

describe("spoken get-off alerts", () => {
  let spoken = [];
  let cancelled = 0;

  class FakeUtterance {
    constructor(text) {
      this.text = text;
      this.lang = "";
      this.rate = 1;
      this.voice = null;
    }
  }

  beforeEach(() => {
    spoken = [];
    cancelled = 0;
    vi.stubGlobal("SpeechSynthesisUtterance", FakeUtterance);
    vi.stubGlobal("speechSynthesis", {
      speak: (utterance) => spoken.push(utterance),
      cancel: () => {
        cancelled += 1;
      },
      getVoices: () => [
        { lang: "en-US", name: "English" },
        { lang: "fi-FI", name: "Suomi" },
      ],
      addEventListener: () => {},
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // The stop name is the one word the passenger is listening for, and an
  // English engine mangles Finnish street names past recognition.
  it("reads the stop name with a Finnish voice", () => {
    expect(speakRideStage("next", "Puistokatu", 3)).toBe(true);

    const name = spoken.find((utterance) => utterance.text === "Puistokatu");
    expect(name).toBeDefined();
    expect(name.lang).toBe("fi-FI");
    expect(name.voice?.lang).toBe("fi-FI");
  });

  it("tells a bus passenger to press STOP and everyone else to get ready", () => {
    speakRideStage("next", "Puistokatu", 3);
    expect(spoken.map((u) => u.text)).toContain("Press the stop button now.");

    spoken = [];
    speakRideStage("next", "Puistokatu", 0);
    expect(spoken.map((u) => u.text)).toContain(
      "Get ready to exit at the next stop."
    );
  });

  it("escalates from a warning to an unambiguous instruction", () => {
    speakRideStage("soon", "Puistokatu");
    expect(spoken.map((u) => u.text)).toContain(
      "Get ready. Your stop is coming up."
    );

    spoken = [];
    speakRideStage("now", "Puistokatu");
    expect(spoken.map((u) => u.text)).toEqual([
      "This is your stop.",
      "Puistokatu",
      "Get off now.",
    ]);
  });

  it("cancels whatever is still being said before a newer stage speaks", () => {
    speakRideStage("soon", "Puistokatu");
    speakRideStage("now", "Puistokatu");
    expect(cancelled).toBe(2);
  });

  it("falls back to a neutral name when the stop has none", () => {
    speakRideStage("now", "");
    expect(spoken.map((u) => u.text)).toContain("your stop");
  });

  it("reports failure instead of throwing when speech is unavailable", () => {
    vi.stubGlobal("SpeechSynthesisUtterance", undefined);
    expect(speakRideStage("now", "Puistokatu")).toBe(false);
  });
});

describe("ride alert delivery", () => {
  let vibrations = [];

  beforeEach(() => {
    vibrations = [];
    Object.defineProperty(navigator, "vibrate", {
      configurable: true,
      value: (pattern) => {
        vibrations.push(pattern);
        return true;
      },
    });
    vi.stubGlobal("SpeechSynthesisUtterance", undefined);
    vi.stubGlobal("Notification", undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("drives every channel it can for one stage", () => {
    expect(() => announceRideStage("now", "Puistokatu", false, 3)).not.toThrow();
    expect(vibrations).toEqual([[260, 100, 260, 100, 320]]);
  });

  it("repeats the get-off signal without repeating the speech", () => {
    repeatNowRideSignal();
    expect(vibrations).toEqual([[260, 100, 260, 100, 320]]);
  });

  it("runs a start-up test alert so the passenger can trust it later", async () => {
    await expect(runRideTestAlert("Puistokatu", false)).resolves.toBeUndefined();
    expect(vibrations).toEqual([[120, 70, 120]]);
  });

  it("cuts haptics short when the ride ends", () => {
    stopRideAlerts();
    expect(vibrations).toEqual([0]);
  });

  it("ignores an unknown stage rather than buzzing at random", () => {
    expect(vibrateRideStage("not-a-stage")).toBe(false);
    expect(playRideTone("not-a-stage")).toBe(false);
    expect(vibrations).toEqual([]);
  });

  it("reports no audio rather than throwing when the platform has none", async () => {
    vi.stubGlobal("AudioContext", undefined);
    vi.stubGlobal("webkitAudioContext", undefined);

    await expect(unlockRideAudio()).resolves.toBe(false);
    expect(playRideTone("now")).toBe(false);
  });
});
