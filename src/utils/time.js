const DEPARTURE_TIME_FIELDS = [
  "expecteddeparturetime",
  "expectedarrivaltime",
  "aimeddeparturetime",
  "aimedarrivaltime",
];

export function getDepartureTime(arrival = {}) {
  for (const field of DEPARTURE_TIME_FIELDS) {
    const value = Number(arrival[field]);
    if (Number.isFinite(value) && value > 0) return value;
  }

  return null;
}

export function formatClock(unixSeconds, locale) {
  const seconds = Number(unixSeconds);
  if (!Number.isFinite(seconds) || seconds <= 0) return "—";

  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(seconds * 1000));
}

export function minutesUntil(unixSeconds, nowMs = Date.now()) {
  const seconds = Number(unixSeconds);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;

  return Math.max(0, Math.ceil((seconds * 1000 - nowMs) / 60_000));
}

export function formatDue(unixSeconds, nowMs = Date.now()) {
  const minutes = minutesUntil(unixSeconds, nowMs);
  if (minutes === null) return "—";
  if (minutes <= 1) return "Due";
  return `${minutes} min`;
}

export function formatDelay(delaySeconds) {
  const seconds = Number(delaySeconds);
  if (!Number.isFinite(seconds)) return null;
  if (Math.abs(seconds) < 30) return "on time";

  const minutes = Math.max(1, Math.round(Math.abs(seconds) / 60));
  return seconds > 0 ? `+${minutes} min` : `${minutes} min early`;
}

export function dataAgeSeconds(recordedAt, serverTime) {
  const recorded = Number(recordedAt);
  const server = Number(serverTime);

  if (
    !Number.isFinite(recorded) ||
    recorded <= 0 ||
    !Number.isFinite(server) ||
    server <= 0
  ) {
    return null;
  }

  return Math.max(0, server - recorded);
}

export function formatServiceStatus(
  monitored,
  delaySeconds,
  recordedAt,
  serverTime
) {
  if (!monitored) return "Scheduled";

  const delay = formatDelay(delaySeconds);
  const ageSeconds = dataAgeSeconds(recordedAt, serverTime);

  let freshness = "Live";
  if (ageSeconds !== null && ageSeconds > 120) {
    freshness = `Live data · ${Math.max(2, Math.round(ageSeconds / 60))} min old`;
  } else if (ageSeconds !== null && ageSeconds > 60) {
    freshness = "Live data · 1 min old";
  }

  return delay ? `${freshness} · ${delay}` : freshness;
}


export function advanceServerTime(
  serverTime,
  receivedAtMs,
  nowMs = Date.now()
) {
  const server = Number(serverTime);
  const received = Number(receivedAtMs);
  const now = Number(nowMs);

  if (!Number.isFinite(server) || server <= 0) return null;
  if (
    !Number.isFinite(received) ||
    received <= 0 ||
    !Number.isFinite(now) ||
    now < received
  ) {
    return server;
  }

  return server + (now - received) / 1000;
}

export function elapsedSince(receivedAtMs, nowMs = Date.now()) {
  const received = Number(receivedAtMs);
  const now = Number(nowMs);

  if (
    !Number.isFinite(received) ||
    received <= 0 ||
    !Number.isFinite(now) ||
    now < received
  ) {
    return null;
  }

  return Math.max(0, (now - received) / 1000);
}

export function formatElapsedAge(seconds) {
  const value = Number(seconds);
  if (!Number.isFinite(value) || value < 0) return "";
  if (value < 60) return "just now";
  if (value < 120) return "1 min ago";
  return `${Math.round(value / 60)} min ago`;
}
