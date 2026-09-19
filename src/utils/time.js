export function formatClock(unixSeconds, locale) {
  if (!Number.isFinite(Number(unixSeconds))) return "—";

  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(Number(unixSeconds) * 1000));
}

export function minutesUntil(unixSeconds, nowMs = Date.now()) {
  if (!Number.isFinite(Number(unixSeconds))) return null;
  return Math.max(0, Math.round((Number(unixSeconds) * 1000 - nowMs) / 60_000));
}

export function formatDue(unixSeconds, nowMs = Date.now()) {
  const minutes = minutesUntil(unixSeconds, nowMs);
  if (minutes === null) return "—";
  if (minutes <= 1) return "Due";
  return `${minutes} min`;
}

export function formatDelay(delaySeconds) {
  const seconds = Number(delaySeconds);
  if (!Number.isFinite(seconds) || Math.abs(seconds) < 30) return "On time";

  const minutes = Math.max(1, Math.round(Math.abs(seconds) / 60));
  return seconds > 0 ? `+${minutes} min` : `${minutes} min early`;
}
