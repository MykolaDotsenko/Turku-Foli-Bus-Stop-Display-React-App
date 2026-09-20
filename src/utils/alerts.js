function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function activeForStop(message, stopId) {
  return (
    message?.isactive === true &&
    asArray(message.affected_stops).some(
      (affectedStop) => String(affectedStop) === String(stopId)
    )
  );
}

export function extractStopAlerts(payload, stopId) {
  if (!payload || Array.isArray(payload) || typeof payload !== "object") {
    return [];
  }

  const messages = asArray(payload.messages)
    .filter((message) => activeForStop(message, stopId))
    .map((message, index) => ({
      id: `message-${message.id ?? index}`,
      type: "message",
      priority: Number.isFinite(Number(message.priority))
        ? Number(message.priority)
        : 9999,
      title:
        typeof message.header === "string" && message.header.trim()
          ? message.header.trim()
          : "Service update",
      message:
        typeof message.message === "string"
          ? message.message.trim()
          : typeof message.information === "string"
            ? message.information.trim()
            : "",
    }));

  const cancellations = asArray(payload.cancellations).flatMap(
    (cancellation, cancellationIndex) => {
      const matchingStops = asArray(cancellation?.stops).filter(
        (stop) =>
          stop?.isactive === true &&
          String(stop.stop) === String(stopId)
      );

      return matchingStops.map((stop, stopIndex) => ({
        id: `cancellation-${cancellation.id ?? cancellationIndex}-${stopIndex}`,
        type: "cancellation",
        priority: -1,
        title: "Cancelled departure",
        line:
          cancellation?.line === null || cancellation?.line === undefined
            ? ""
            : String(cancellation.line),
        cause:
          typeof cancellation?.cause === "string"
            ? cancellation.cause.trim()
            : "",
        scheduledTime: Number.isFinite(Number(stop.arrival))
          ? Number(stop.arrival)
          : null,
      }));
    }
  );

  return [...cancellations, ...messages].sort(
    (a, b) => a.priority - b.priority
  );
}
