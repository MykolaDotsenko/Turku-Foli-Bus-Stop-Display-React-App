const DEPARTURE_TIME_FIELDS = [
  "expecteddeparturetime",
  "expectedarrivaltime",
  "aimeddeparturetime",
  "aimedarrivaltime",
];

export function getDepartureTime(arrival = {}, referenceTimeSec = null) {
  const values = Object.fromEntries(
    DEPARTURE_TIME_FIELDS.map((field) => {
      const value = Number(arrival[field]);
      return [field, Number.isFinite(value) && value > 0 ? value : null];
    })
  );

  const reference = Number(referenceTimeSec);
  if (Number.isFinite(reference) && reference > 0) {
    const earliestPlausible = reference - 30;
    const expected =
      values.expecteddeparturetime ?? values.expectedarrivaltime;
    const aimed = values.aimeddeparturetime ?? values.aimedarrivaltime;

    if (expected !== null && expected >= earliestPlausible) return expected;
    if (aimed !== null && aimed >= earliestPlausible) return aimed;

    return expected ?? aimed ?? null;
  }

  for (const field of DEPARTURE_TIME_FIELDS) {
    if (values[field] !== null) return values[field];
  }

  return null;
}

// Departure times belong to the Turku region, not to wherever the device
// thinks it is. A phone still set to another zone must not show a bus leaving
// at the wrong wall-clock time.
export const SERVICE_TIME_ZONE = "Europe/Helsinki";

export function serviceDateTimeFormat(options, locale) {
  try {
    return new Intl.DateTimeFormat(locale, {
      ...options,
      timeZone: SERVICE_TIME_ZONE,
    });
  } catch {
    // A runtime without the full time zone database still gets a usable
    // clock, just in its own zone.
    return new Intl.DateTimeFormat(locale, options);
  }
}

// Stop timetables and the signs on the buses use the 24-hour clock, so every
// transit time does too, whatever language the phone is set to.
export const TRANSIT_CLOCK_LOCALE = "en-GB";

export function formatClock(unixSeconds, locale = TRANSIT_CLOCK_LOCALE) {
  const seconds = Number(unixSeconds);
  if (!Number.isFinite(seconds) || seconds <= 0) return "—";

  return serviceDateTimeFormat(
    {
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    },
    locale
  ).format(new Date(seconds * 1000));
}

export function minutesUntil(unixSeconds, nowMs = Date.now()) {
  const seconds = Number(unixSeconds);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;

  return Math.max(0, Math.ceil((seconds * 1000 - nowMs) / 60_000));
}

function serviceDayKey(valueMs) {
  try {
    const parts = serviceDateTimeFormat(
      {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      },
      "en-CA"
    ).formatToParts(new Date(valueMs));
    const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${byType.year}-${byType.month}-${byType.day}`;
  } catch {
    return "";
  }
}

function dayDistance(leftKey, rightKey) {
  const left = String(leftKey || "").split("-").map(Number);
  const right = String(rightKey || "").split("-").map(Number);
  if (left.length !== 3 || right.length !== 3 || [...left, ...right].some(Number.isNaN)) {
    return null;
  }

  return Math.round(
    (Date.UTC(right[0], right[1] - 1, right[2]) -
      Date.UTC(left[0], left[1] - 1, left[2])) /
      86_400_000
  );
}

export function formatDue(unixSeconds, nowMs = Date.now()) {
  const minutes = minutesUntil(unixSeconds, nowMs);
  if (minutes === null) return "—";
  if (minutes <= 1) return "Due";
  if (minutes <= 90) return `${minutes} min`;

  const departureMs = Number(unixSeconds) * 1000;
  const days = dayDistance(serviceDayKey(nowMs), serviceDayKey(departureMs));
  const clock = formatClock(unixSeconds);

  if (days === 0) return `Today ${clock}`;
  if (days === 1) return `Tomorrow ${clock}`;

  return serviceDateTimeFormat(
    {
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    },
    TRANSIT_CLOCK_LOCALE
  ).format(new Date(departureMs));
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
  if (seconds === null || seconds === undefined || seconds === "") return "";

  const value = Number(seconds);
  if (!Number.isFinite(value) || value < 0) return "";
  if (value < 60) return "just now";
  if (value < 120) return "1 min ago";
  return `${Math.round(value / 60)} min ago`;
}
