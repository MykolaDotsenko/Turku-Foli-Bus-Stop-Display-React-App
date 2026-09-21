export const RIDE_STAGE = Object.freeze({
  BOARDED: "boarded",
  SOON: "soon",
  NEXT: "next",
  NOW: "now",
  MISSED: "missed",
});

const STAGE_RANK = {
  [RIDE_STAGE.BOARDED]: 0,
  [RIDE_STAGE.SOON]: 1,
  [RIDE_STAGE.NEXT]: 2,
  [RIDE_STAGE.NOW]: 3,
  [RIDE_STAGE.MISSED]: 4,
};

function finiteNumber(value) {
  // `Number(null)` is 0, so without this guard every "no data yet" signal
  // reads as zero metres and zero seconds away: a ride with no provider match
  // and no location fix would announce "get off now" seconds after starting.
  if (value === null || value === undefined || value === "") return null;

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function rideStageRank(stage) {
  return STAGE_RANK[stage] ?? 0;
}

export function gtfsTimeToSeconds(value) {
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^(\d{1,3}):(\d{2}):(\d{2})$/);
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3]);

  if (
    !Number.isFinite(hour) ||
    !Number.isFinite(minute) ||
    !Number.isFinite(second) ||
    minute > 59 ||
    second > 59
  ) {
    return null;
  }

  return hour * 3600 + minute * 60 + second;
}

function stopTimeSeconds(item) {
  return (
    gtfsTimeToSeconds(item?.departureTime) ??
    gtfsTimeToSeconds(item?.arrivalTime)
  );
}

function stopDetails(stopId, stopsById) {
  const stop = stopsById?.get?.(String(stopId));
  const lat = finiteNumber(stop?.lat);
  const lon = finiteNumber(stop?.lon);

  return {
    id: String(stopId),
    name: String(stop?.name || `Stop ${stopId}`),
    ...(lat !== null && lon !== null ? { lat, lon } : {}),
  };
}

function helsinkiClockSeconds(epochSec) {
  const epoch = finiteNumber(epochSec);
  if (epoch === null || epoch <= 0) return null;

  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Helsinki",
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).formatToParts(new Date(epoch * 1000));

    const byType = Object.fromEntries(
      parts.map((part) => [part.type, part.value])
    );
    const hour = Number(byType.hour) % 24;
    const minute = Number(byType.minute);
    const second = Number(byType.second);

    if (![hour, minute, second].every(Number.isFinite)) return null;
    return hour * 3600 + minute * 60 + second;
  } catch {
    return null;
  }
}

function circularClockDeltaSeconds(a, b) {
  const left = finiteNumber(a);
  const right = finiteNumber(b);
  if (left === null || right === null) return Number.POSITIVE_INFINITY;

  const day = 24 * 60 * 60;
  const diff = Math.abs((left % day) - (right % day));
  return Math.min(diff, day - diff);
}

export function resolveRideBoardingIndex(
  stopTimes,
  currentStopId,
  aimedDepartureEpochSec
) {
  const rows = Array.isArray(stopTimes) ? stopTimes : [];
  const candidates = rows
    .map((item, index) =>
      String(item?.stopId) === String(currentStopId) ? index : -1
    )
    .filter((index) => index >= 0);

  if (candidates.length === 1) return candidates[0];
  if (candidates.length === 0) return -1;

  const aimedClock = helsinkiClockSeconds(aimedDepartureEpochSec);
  if (aimedClock === null) return -1;

  const ranked = candidates
    .map((index) => ({
      index,
      delta: circularClockDeltaSeconds(
        stopTimeSeconds(rows[index]),
        aimedClock
      ),
    }))
    .sort((a, b) => a.delta - b.delta);

  if (ranked[0].delta > 10 * 60) return -1;
  if (ranked[1] && ranked[1].delta - ranked[0].delta < 30) return -1;

  return ranked[0].index;
}

export function buildRidePlan({
  stopTimes,
  currentStopId,
  currentStopAimedEpochSec,
  targetStopId,
  targetStopSequence,
  stopsById,
  departureEpochSec,
}) {
  if (!Array.isArray(stopTimes) || stopTimes.length < 2) return null;

  const boardingIndex = resolveRideBoardingIndex(
    stopTimes,
    currentStopId,
    currentStopAimedEpochSec
  );
  if (boardingIndex < 0) return null;

  const targetSequence = finiteNumber(targetStopSequence);
  const targetIndex = stopTimes.findIndex(
    (item, index) =>
      index > boardingIndex &&
      Number(item?.dropOffType) !== 1 &&
      (targetSequence !== null
        ? finiteNumber(item?.stopSequence) === targetSequence
        : String(item?.stopId) === String(targetStopId))
  );
  if (targetIndex < 0) return null;

  const boardingScheduleSec = stopTimeSeconds(stopTimes[boardingIndex]);
  const departure = finiteNumber(departureEpochSec);
  if (boardingScheduleSec === null || departure === null || departure <= 0) {
    return null;
  }

  const throughRecovery = stopTimes.slice(
    boardingIndex,
    Math.min(stopTimes.length, targetIndex + 2)
  );

  const routeStops = throughRecovery.map((item) => {
    const scheduleSec = stopTimeSeconds(item);
    const offsetSec =
      scheduleSec === null
        ? null
        : Math.max(0, scheduleSec - boardingScheduleSec);

    return {
      ...stopDetails(item.stopId, stopsById),
      stopSequence: finiteNumber(item.stopSequence),
      arrivalTime: item.arrivalTime || "",
      departureTime: item.departureTime || "",
      timepoint: finiteNumber(item.timepoint),
      dropOffType: finiteNumber(item.dropOffType),
      shapeDistTraveled: finiteNumber(item.shapeDistTraveled),
      offsetSec,
      predictedEpochSec:
        offsetSec === null ? null : Math.round(departure + offsetSec),
    };
  });

  const relativeTargetIndex = targetIndex - boardingIndex;
  const boardingStop = routeStops[0];
  const targetStop = routeStops[relativeTargetIndex];
  const previousStop =
    relativeTargetIndex > 0 ? routeStops[relativeTargetIndex - 1] : null;
  const nextStop = routeStops[relativeTargetIndex + 1] || null;

  return {
    boardingStop,
    targetStop,
    previousStop,
    nextStop,
    routeStops,
    stopsToTarget: routeStops.slice(1, relativeTargetIndex + 1),
    targetPredictedEpochSec: targetStop?.predictedEpochSec ?? null,
  };
}

function normalizedString(value) {
  return value === null || value === undefined ? "" : String(value).trim();
}

export function matchRideArrival(arrivals, identity) {
  const rows = Array.isArray(arrivals) ? arrivals : [];
  if (rows.length === 0 || !identity) return null;

  const journey = normalizedString(identity.datedVehicleJourneyRef);
  if (journey) {
    const arrival = rows.find(
      (row) => normalizedString(row?.datedvehiclejourneyref) === journey
    );
    if (arrival) return { arrival, matchedBy: "dated-journey" };
  }

  const trip = normalizedString(identity.tripRef);
  if (trip) {
    const arrival = rows.find(
      (row) => normalizedString(row?.tripref) === trip
    );
    if (arrival) return { arrival, matchedBy: "trip" };
  }

  const vehicle = normalizedString(identity.vehicleRef);
  if (vehicle) {
    const arrival = rows.find(
      (row) => normalizedString(row?.vehicleref) === vehicle
    );
    if (arrival) return { arrival, matchedBy: "vehicle" };
  }

  const line = normalizedString(identity.lineRef);
  const originTime = finiteNumber(identity.originAimedDepartureTime);
  if (line && originTime !== null) {
    const arrival = rows.find((row) => {
      const rowOrigin = finiteNumber(row?.originaimeddeparturetime);
      return (
        normalizedString(row?.lineref) === line &&
        rowOrigin !== null &&
        Math.abs(rowOrigin - originTime) <= 90
      );
    });
    if (arrival) return { arrival, matchedBy: "line-origin-time" };
  }

  return null;
}

export function arrivalEtaSeconds(arrival, referenceTimeSec) {
  const reference = finiteNumber(referenceTimeSec);
  if (!arrival || reference === null) return null;

  const epoch =
    finiteNumber(arrival.expectedarrivaltime) ??
    finiteNumber(arrival.expecteddeparturetime) ??
    finiteNumber(arrival.aimedarrivaltime) ??
    finiteNumber(arrival.aimeddeparturetime);

  return epoch === null ? null : Math.round(epoch - reference);
}

export function plannedRideProgress(plan, nowSec) {
  const now = finiteNumber(nowSec);
  if (!plan || now === null) {
    return { etaSec: null, remainingStops: null };
  }

  const targetEpoch = finiteNumber(plan.targetPredictedEpochSec);
  const etaSec = targetEpoch === null ? null : Math.round(targetEpoch - now);

  const futureStops = Array.isArray(plan.stopsToTarget)
    ? plan.stopsToTarget.filter((stop) => {
        const predicted = finiteNumber(stop?.predictedEpochSec);
        return predicted === null || predicted >= now - 20;
      })
    : [];

  return {
    etaSec,
    remainingStops: futureStops.length,
  };
}

function candidateStage(signals) {
  const liveEta = finiteNumber(signals.liveEtaSec);
  const scheduleEta = finiteNumber(signals.scheduleEtaSec);
  const remaining = finiteNumber(signals.remainingStops);
  const providerDistance = finiteNumber(signals.providerDistanceM);
  const providerAge = finiteNumber(signals.providerPositionAgeSec);
  const gpsDistance = finiteNumber(signals.gpsDistanceM);
  const gpsAccuracy = finiteNumber(signals.gpsAccuracyM);
  const gpsRouteDistance = finiteNumber(signals.gpsRouteDistanceM);
  const gpsRouteEta = finiteNumber(signals.gpsRouteEtaSec);

  const freshProviderPosition =
    providerDistance !== null &&
    (providerAge === null || providerAge <= 120);
  const reliableGps =
    gpsDistance !== null &&
    gpsAccuracy !== null &&
    gpsAccuracy <= 120;
  const reliableShapeGps =
    signals.gpsShapeUsable === true &&
    signals.gpsOnRoute === true &&
    gpsRouteDistance !== null &&
    gpsAccuracy !== null &&
    gpsAccuracy <= 120;

  const scheduleIsAuthoritative = liveEta === null;
  const scheduleSaysNext =
    scheduleIsAuthoritative &&
    ((remaining !== null && remaining <= 1) ||
      (scheduleEta !== null && scheduleEta <= 90));
  const scheduleSaysSoon =
    scheduleIsAuthoritative &&
    ((remaining !== null && remaining <= 3) ||
      (scheduleEta !== null && scheduleEta <= 300));

  const shapeSaysNext =
    reliableShapeGps &&
    ((gpsRouteDistance >= -50 && gpsRouteDistance <= 600) ||
      (gpsRouteEta !== null && gpsRouteEta <= 90));
  const nextEvidence =
    signals.previousPassedConfirmed === true ||
    shapeSaysNext ||
    (liveEta !== null && liveEta <= 90) ||
    scheduleSaysNext;
  const nearEndOfRide =
    signals.currentAtLeastNext === true || nextEvidence;

  if (signals.targetAtStop === true) {
    return {
      stage: RIDE_STAGE.NOW,
      reason: "target-at-stop",
      confidence: "live",
    };
  }

  if (nearEndOfRide && freshProviderPosition && providerDistance <= 60) {
    return {
      stage: RIDE_STAGE.NOW,
      reason: "provider-near-target",
      confidence: "live",
    };
  }

  if (
    nearEndOfRide &&
    reliableShapeGps &&
    gpsRouteDistance >= -30 &&
    gpsRouteDistance <= 110
  ) {
    return {
      stage: RIDE_STAGE.NOW,
      reason: "gps-route-arrival",
      confidence: "location",
    };
  }

  if (
    nearEndOfRide &&
    signals.gpsShapeAvailable !== true &&
    reliableGps &&
    gpsDistance <= 60
  ) {
    return {
      stage: RIDE_STAGE.NOW,
      reason: "device-near-target",
      confidence: "location",
    };
  }

  if (nextEvidence) {
    const gpsDistanceNext =
      reliableShapeGps &&
      gpsRouteDistance >= -50 &&
      gpsRouteDistance <= 600;
    return {
      stage: RIDE_STAGE.NEXT,
      reason:
        signals.previousPassedConfirmed === true
          ? "previous-stop-passed"
          : gpsDistanceNext
            ? "gps-route-distance"
            : reliableShapeGps &&
                gpsRouteEta !== null &&
                gpsRouteEta <= 90
              ? "gps-route-eta"
              : liveEta !== null && liveEta <= 90
                ? "live-eta"
                : remaining !== null && remaining <= 1
                  ? "planned-stop-count"
                  : "schedule-fallback",
      confidence:
        signals.previousPassedConfirmed === true || liveEta !== null
          ? "live"
          : reliableShapeGps
            ? "location"
            : "schedule",
    };
  }

  const shapeSaysSoon =
    reliableShapeGps &&
    ((gpsRouteDistance >= 0 && gpsRouteDistance <= 1200) ||
      (gpsRouteEta !== null && gpsRouteEta <= 300));

  if (
    shapeSaysSoon ||
    (liveEta !== null && liveEta <= 300) ||
    scheduleSaysSoon
  ) {
    const gpsDistanceSoon =
      reliableShapeGps &&
      gpsRouteDistance >= 0 &&
      gpsRouteDistance <= 1200;
    return {
      stage: RIDE_STAGE.SOON,
      reason: gpsDistanceSoon
        ? "gps-route-distance"
        : reliableShapeGps &&
            gpsRouteEta !== null &&
            gpsRouteEta <= 300
          ? "gps-route-eta"
          : liveEta !== null && liveEta <= 300
            ? "live-eta"
            : remaining !== null && remaining <= 3
              ? "planned-stop-count"
              : "schedule-fallback",
      confidence: reliableShapeGps
        ? "location"
        : liveEta !== null
          ? "live"
          : "schedule",
    };
  }

  return {
    stage: RIDE_STAGE.BOARDED,
    reason: "tracking",
    confidence: "live",
  };
}

export function evaluateRideStage(currentStage, signals = {}) {
  if (currentStage === RIDE_STAGE.MISSED) {
    return {
      stage: currentStage,
      reason: "already-missed",
      confidence: "live",
    };
  }

  if (
    rideStageRank(currentStage) >= rideStageRank(RIDE_STAGE.NEXT) &&
    (signals.targetPassedConfirmed === true ||
      signals.gpsPassedTarget === true ||
      signals.gpsMovedAwayAfterNear === true)
  ) {
    return {
      stage: RIDE_STAGE.MISSED,
      reason:
        signals.targetPassedConfirmed === true
          ? "target-passed"
          : signals.gpsPassedTarget === true
            ? "gps-route-passed"
            : "device-moved-away",
      confidence:
        signals.targetPassedConfirmed === true ? "live" : "location",
    };
  }

  const currentAtLeastNext =
    rideStageRank(currentStage) >= rideStageRank(RIDE_STAGE.NEXT);
  const candidate = candidateStage({ ...signals, currentAtLeastNext });

  return rideStageRank(candidate.stage) > rideStageRank(currentStage)
    ? candidate
    : {
        stage: currentStage,
        reason: signals.lastReason || "monotonic-hold",
        confidence: signals.lastConfidence || candidate.confidence,
      };
}
