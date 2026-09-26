import { msg } from "../i18n";

// Phrases, not text: each is translated where it is shown, spoken or sent,
// so it is in the passenger's language at that moment.
export function rideExitInstruction(routeType) {
  const type = Number(routeType);

  if (type === 3 || type === 11) {
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
