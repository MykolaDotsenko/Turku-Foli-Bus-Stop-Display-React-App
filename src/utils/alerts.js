function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function messageId(message, index, prefix) {
  return `${prefix}-${message?.message_id ?? message?.id ?? index}`;
}

function routeNamesFor(message, routesById) {
  return asArray(message?.affected_routes)
    .map((routeId) => routesById.get(String(routeId))?.shortName)
    .filter(Boolean);
}

function messageMatchesContext(message, stopId, activeLines, routesById) {
  const stopMatch = asArray(message?.affected_stops).some(
    (affectedStop) => String(affectedStop) === String(stopId)
  );

  if (stopMatch) return true;

  const routeNames = routeNamesFor(message, routesById);
  return routeNames.some((line) => activeLines.has(line));
}

function effectLabel(effect) {
  const labels = {
    NO_SERVICE: "No service",
    REDUCED_SERVICE: "Reduced service",
    SIGNIFICANT_DELAYS: "Significant delays",
    DETOUR: "Detour",
    ADDITIONAL_SERVICE: "Additional service",
    MODIFIED_SERVICE: "Modified service",
    STOP_MOVED: "Stop moved",
  };

  return labels[effect] || "Service update";
}

function normalizeMessage(message, index, type, routesById) {
  const routeNames = routeNamesFor(message, routesById);
  const effect = text(message?.effect);

  return {
    id: messageId(message, index, type),
    type,
    priority: Number.isFinite(Number(message?.priority))
      ? Number(message.priority)
      : type === "global"
        ? 0
        : 9999,
    title:
      text(message?.header) ||
      (type === "global" ? "Föli service notice" : effectLabel(effect)),
    message: text(message?.message),
    information: text(message?.information),
    effect,
    effectLabel: effectLabel(effect),
    cause: text(message?.cause),
    icon: text(message?.icon),
    routeNames,
  };
}

function normalizeSpecial(value, type, fallbackTitle) {
  if (!value) return null;

  if (typeof value === "string") {
    const message = value.trim();
    return message
      ? {
          id: type,
          type,
          priority: type === "emergency" ? -1000 : -100,
          title: fallbackTitle,
          message,
          information: "",
          effect: "",
          effectLabel: fallbackTitle,
          cause: "",
          icon: "",
          routeNames: [],
        }
      : null;
  }

  if (Array.isArray(value) || typeof value !== "object") return null;

  const hasContent = [
    value.header,
    value.message,
    value.information,
    value.effect,
    value.cause,
  ].some((field) => text(field));

  if (!hasContent) return null;

  const normalized = normalizeMessage(value, 0, type, new Map());

  return {
    ...normalized,
    id: type,
    priority: type === "emergency" ? -1000 : -100,
    title: text(value?.header) || fallbackTitle,
  };
}

export function extractStopAlerts(
  payload,
  { stopId, lineRefs = [], routesById = new Map() } = {}
) {
  if (!payload || Array.isArray(payload) || typeof payload !== "object") {
    return [];
  }

  const emergency = normalizeSpecial(
    payload.emergency_message,
    "emergency",
    "Emergency service notice"
  );

  if (emergency) return [emergency];

  const activeLines = new Set(lineRefs.map(String));

  const globalMessage = normalizeSpecial(
    payload.global_message,
    "global",
    "Föli service notice"
  );

  const messages = asArray(payload.messages)
    .filter(
      (message) =>
        message?.isactive === true &&
        messageMatchesContext(message, stopId, activeLines, routesById)
    )
    .map((message, index) =>
      normalizeMessage(message, index, "message", routesById)
    );

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
        priority: -500,
        title: "Cancelled departure",
        line:
          cancellation?.line === null || cancellation?.line === undefined
            ? ""
            : String(cancellation.line),
        cause: text(cancellation?.cause),
        scheduledTime: Number.isFinite(Number(stop.arrival))
          ? Number(stop.arrival)
          : null,
        routeNames: cancellation?.line ? [String(cancellation.line)] : [],
        message: "",
        information: "",
        effect: "NO_SERVICE",
        effectLabel: "No service",
      }));
    }
  );

  return [globalMessage, ...cancellations, ...messages]
    .filter(Boolean)
    .sort((a, b) => a.priority - b.priority);
}
