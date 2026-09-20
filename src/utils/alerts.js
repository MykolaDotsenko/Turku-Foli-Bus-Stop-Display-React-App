function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function messageId(message, index, prefix) {
  return `${prefix}-${message?.message_id ?? message?.id ?? index}`;
}

function normalizeLanguage(value) {
  return String(value || "").trim().toLowerCase().replaceAll("_", "-");
}

function translationFor(message, preferredLanguages = []) {
  const translations =
    message?.translations && typeof message.translations === "object"
      ? message.translations
      : null;
  if (!translations) return null;

  const entries = Object.entries(translations).filter(
    ([, value]) => value && typeof value === "object"
  );

  for (const requested of preferredLanguages) {
    const normalized = normalizeLanguage(requested);
    if (!normalized) continue;

    const exact = entries.find(
      ([key]) => normalizeLanguage(key) === normalized
    );
    if (exact) return exact[1];

    const base = normalized.split("-")[0];
    const sameLanguage = entries.find(([key]) => {
      const candidate = normalizeLanguage(key);
      return candidate === base || candidate.startsWith(`${base}-`);
    });
    if (sameLanguage) return sameLanguage[1];
  }

  return null;
}

function localizedFields(message, preferredLanguages) {
  const translation = translationFor(message, preferredLanguages);

  return {
    header: text(translation?.header) || text(message?.header),
    message: text(translation?.message) || text(message?.message),
    information:
      text(translation?.information) || text(message?.information),
  };
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

function normalizeMessage(
  message,
  index,
  type,
  routesById,
  preferredLanguages = []
) {
  const routeNames = routeNamesFor(message, routesById);
  const effect = text(message?.effect);
  const localized = localizedFields(message, preferredLanguages);

  return {
    id: messageId(message, index, type),
    type,
    priority: Number.isFinite(Number(message?.priority))
      ? Number(message.priority)
      : type === "global"
        ? 0
        : 9999,
    title:
      localized.header ||
      (type === "global" ? "Föli service notice" : effectLabel(effect)),
    message: localized.message,
    information: localized.information,
    effect,
    effectLabel: effectLabel(effect),
    cause: text(message?.cause),
    icon: text(message?.icon),
    routeNames,
  };
}

function normalizeSpecial(
  value,
  type,
  fallbackTitle,
  preferredLanguages = []
) {
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

  const normalized = normalizeMessage(
    value,
    0,
    type,
    new Map(),
    preferredLanguages
  );

  return {
    ...normalized,
    id: type,
    priority: type === "emergency" ? -1000 : -100,
    title:
      localizedFields(value, preferredLanguages).header || fallbackTitle,
  };
}

export function extractStopAlerts(
  payload,
  {
    stopId,
    lineRefs = [],
    routesById = new Map(),
    preferredLanguages = [],
  } = {}
) {
  if (!payload || Array.isArray(payload) || typeof payload !== "object") {
    return [];
  }

  const emergency = normalizeSpecial(
    payload.emergency_message,
    "emergency",
    "Emergency service notice",
    preferredLanguages
  );

  if (emergency) return [emergency];

  const activeLines = new Set(lineRefs.map(String));

  const globalMessage = normalizeSpecial(
    payload.global_message,
    "global",
    "Föli service notice",
    preferredLanguages
  );

  const messages = asArray(payload.messages)
    .filter(
      (message) =>
        message?.isactive === true &&
        messageMatchesContext(message, stopId, activeLines, routesById)
    )
    .map((message, index) =>
      normalizeMessage(
        message,
        index,
        "message",
        routesById,
        preferredLanguages
      )
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
