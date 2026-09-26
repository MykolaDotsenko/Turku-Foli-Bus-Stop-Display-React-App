import { msg } from "../i18n";

// Phrases, not text: each is translated where it is shown, spoken or sent,
// so it is in the passenger's language at that moment.
// Nearly every Föli trip is a bus, where a missed "Press STOP" can cost the
// passenger their stop and an extra one costs nothing. So a type that could
// not be loaded (trip details failed on a weak connection) counts as a bus;
// only a type known not to be one gets the generic wording.
function busLike(routeType) {
  if (routeType === null || routeType === undefined || routeType === "") return true;
  const type = Number(routeType);
  if (!Number.isFinite(type)) return true;
  return (
    type === 3 ||
    type === 11 ||
    (type >= 200 && type < 300) ||
    (type >= 700 && type < 800)
  );
}

export function rideExitInstruction(routeType) {
  if (busLike(routeType)) {
    return {
      kind: "request-stop",
      nextText: msg("Press the STOP button now."),
      nextVoice: msg("Press the stop button now."),
      nextNotification: msg("Press the STOP button now."),
    };
  }

  return {
    kind: "prepare-exit",
    nextText: msg("Get ready to exit at the next stop."),
    nextVoice: msg("Get ready to exit at the next stop."),
    nextNotification: msg("Get ready to exit at the next stop."),
  };
}
