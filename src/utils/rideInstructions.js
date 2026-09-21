export function rideExitInstruction(routeType) {
  const type = Number(routeType);

  if (type === 3 || type === 11) {
    return {
      kind: "request-stop",
      nextText: "Press the STOP button now.",
      nextVoice: "Press the stop button now.",
      nextNotification: "Press the STOP button now.",
    };
  }

  return {
    kind: "prepare-exit",
    nextText: "Get ready to exit at the next stop.",
    nextVoice: "Get ready to exit at the next stop.",
    nextNotification: "Get ready to exit at the next stop.",
  };
}
