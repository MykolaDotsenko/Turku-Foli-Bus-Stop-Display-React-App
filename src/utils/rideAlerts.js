import { rideExitInstruction } from "./rideInstructions";

const ALERT_PATTERNS = {
  test: {
    tones: [660, 880],
    vibration: [120, 70, 120],
  },
  soon: {
    tones: [660],
    vibration: [120],
  },
  next: {
    tones: [660, 880],
    vibration: [180, 90, 180],
  },
  now: {
    tones: [880, 1040, 880],
    vibration: [260, 100, 260, 100, 320],
  },
  missed: {
    tones: [520, 420],
    vibration: [300, 120, 300],
  },
};

let audioContext = null;

function AudioContextConstructor() {
  return globalThis.AudioContext || globalThis.webkitAudioContext || null;
}

function getAudioContext() {
  if (audioContext) return audioContext;
  const AudioContext = AudioContextConstructor();
  if (!AudioContext) return null;

  try {
    audioContext = new AudioContext();
    return audioContext;
  } catch {
    return null;
  }
}

export async function unlockRideAudio() {
  const context = getAudioContext();
  if (!context) return false;

  try {
    if (context.state === "suspended") {
      await context.resume();
    }
    return context.state === "running";
  } catch {
    return false;
  }
}

export function playRideTone(stage) {
  const pattern = ALERT_PATTERNS[stage];
  const context = getAudioContext();
  if (!pattern || !context || context.state !== "running") return false;

  try {
    const startAt = context.currentTime + 0.02;
    pattern.tones.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const noteStart = startAt + index * 0.23;
      const noteEnd = noteStart + 0.15;

      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, noteStart);
      gain.gain.exponentialRampToValueAtTime(0.09, noteStart + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, noteEnd);

      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(noteStart);
      oscillator.stop(noteEnd + 0.02);
    });
    return true;
  } catch {
    return false;
  }
}

export function vibrateRideStage(stage) {
  const pattern = ALERT_PATTERNS[stage]?.vibration;
  if (!pattern || typeof globalThis.navigator?.vibrate !== "function") {
    return false;
  }

  try {
    return globalThis.navigator.vibrate(pattern);
  } catch {
    return false;
  }
}

function speechSupported() {
  return (
    typeof globalThis.SpeechSynthesisUtterance === "function" &&
    typeof globalThis.speechSynthesis?.speak === "function"
  );
}

function finnishVoice() {
  const voices = globalThis.speechSynthesis?.getVoices?.() || [];
  return (
    voices.find((voice) => String(voice.lang || "").toLowerCase() === "fi-fi") ||
    voices.find((voice) =>
      String(voice.lang || "").toLowerCase().startsWith("fi")
    ) ||
    null
  );
}

function speakUtterance(text, lang, voice = null) {
  const utterance = new globalThis.SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = 0.92;
  if (voice) utterance.voice = voice;
  globalThis.speechSynthesis.speak(utterance);
}

export function speakRideStage(stage, stopName) {
  if (!speechSupported()) return false;

  const name = String(stopName || "your stop").trim();
  const fiVoice = finnishVoice();

  try {
    globalThis.speechSynthesis.cancel();

    if (stage === "test") {
      speakUtterance("Ride alerts are working.", "en-US");
      speakUtterance(name, "fi-FI", fiVoice);
      return true;
    }

    if (stage === "soon") {
      speakUtterance("Get ready. Your stop is coming up.", "en-US");
      speakUtterance(name, "fi-FI", fiVoice);
      return true;
    }

    if (stage === "next") {
      speakUtterance("The next stop is yours.", "en-US");
      speakUtterance(name, "fi-FI", fiVoice);
      speakUtterance("Press the stop button now.", "en-US");
      return true;
    }

    if (stage === "now") {
      speakUtterance("This is your stop.", "en-US");
      speakUtterance(name, "fi-FI", fiVoice);
      speakUtterance("Get off now.", "en-US");
      return true;
    }

    if (stage === "missed") {
      speakUtterance(
        "It looks like your stop is behind you. Get off at the next stop.",
        "en-US"
      );
      return true;
    }
  } catch {
    return false;
  }

  return false;
}

export async function requestRideNotificationPermission() {
  const NotificationApi = globalThis.Notification;
  if (!NotificationApi) return false;

  if (NotificationApi.permission === "granted") return true;
  if (NotificationApi.permission === "denied") return false;

  try {
    return (await NotificationApi.requestPermission()) === "granted";
  } catch {
    return false;
  }
}

function notificationCopy(stage, stopName) {
  const name = String(stopName || "your stop").trim();

  if (stage === "soon") {
    return {
      title: "Get ready",
      body: `${name} is coming up soon.`,
    };
  }
  if (stage === "next") {
    return {
      title: `Next stop: ${name}`,
      body: "Press the STOP button now.",
    };
  }
  if (stage === "now") {
    return {
      title: `This is your stop: ${name}`,
      body: "Get off now.",
    };
  }
  if (stage === "missed") {
    return {
      title: "Your stop may be behind you",
      body: "Get off at the next stop and use recovery help.",
    };
  }
  return {
    title: "Ride alerts are working",
    body: name,
  };
}

export async function showRideNotification(stage, stopName) {
  const NotificationApi = globalThis.Notification;
  if (!NotificationApi || NotificationApi.permission !== "granted") {
    return false;
  }

  const copy = notificationCopy(stage, stopName);
  const options = {
    body: copy.body,
    tag: "foli-active-ride",
    renotify: stage === "now" || stage === "missed",
    requireInteraction: stage === "now",
    icon: "/foli-icon.svg",
  };

  try {
    const registration =
      typeof globalThis.navigator?.serviceWorker?.getRegistration === "function"
        ? await globalThis.navigator.serviceWorker.getRegistration()
        : null;

    if (registration?.showNotification) {
      await registration.showNotification(copy.title, options);
      return true;
    }

    if (typeof NotificationApi === "function") {
      new NotificationApi(copy.title, options);
      return true;
    }
  } catch {
    return false;
  }

  return false;
}

export function announceRideStage(stage, stopName, notificationsEnabled = true) {
  playRideTone(stage);
  vibrateRideStage(stage);
  speakRideStage(stage, stopName);

  if (notificationsEnabled) {
    void showRideNotification(stage, stopName);
  }
}

export function repeatNowRideSignal() {
  playRideTone("now");
  vibrateRideStage("now");
}

export async function runRideTestAlert(stopName, notificationsEnabled = true) {
  await unlockRideAudio();
  playRideTone("test");
  vibrateRideStage("test");
  speakRideStage("test", stopName);

  if (notificationsEnabled) {
    void showRideNotification("test", stopName);
  }
}

export function stopRideAlerts() {
  try {
    globalThis.navigator?.vibrate?.(0);
  } catch {
    // Best-effort haptic cleanup only.
  }

  try {
    globalThis.speechSynthesis?.cancel?.();
  } catch {
    // Speech is optional.
  }
}

export function rideAlertCapabilities() {
  return {
    audio: Boolean(AudioContextConstructor()),
    vibration: typeof globalThis.navigator?.vibrate === "function",
    speech: speechSupported(),
    notifications: Boolean(globalThis.Notification),
    wakeLock: Boolean(globalThis.navigator?.wakeLock?.request),
  };
}
