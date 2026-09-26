import { findNearestStops, isInsideMultiPolygon } from "./geo";

// The rules for when a location may pick a stop by itself, shared by every
// place that offers "nearest stop". The search box's locate button used to
// skip them all: a Helsinki fix with ±3 km accuracy quietly filled in a
// stop in Salo.
export const AUTO_SELECT_MAX_DISTANCE_METERS = 2_000;
export const AUTO_SELECT_MAX_ACCURACY_METERS = 250;
export const OUTSIDE_NETWORK_WARNING_METERS = 10_000;
const MIN_AMBIGUITY_GAP_METERS = 25;
const MAX_AMBIGUITY_GAP_METERS = 150;

export function nearestChoiceIsAmbiguous(nearbyStops, accuracy) {
  if (nearbyStops.length < 2) return false;

  const uncertainty = Number.isFinite(accuracy)
    ? Math.min(
        MAX_AMBIGUITY_GAP_METERS,
        Math.max(MIN_AMBIGUITY_GAP_METERS, accuracy)
      )
    : MIN_AMBIGUITY_GAP_METERS;

  return (
    nearbyStops[1].distanceMeters - nearbyStops[0].distanceMeters <
    uncertainty
  );
}

// Whether the nearest stop can be taken as the passenger's stop without
// asking. Anything but "confident" leaves the choice to them.
export function judgeNearestStop(stops, position, serviceBoundary = null) {
  const nearby = findNearestStops(stops, position, 2);
  const closest = nearby[0] || null;

  if (!closest) return { verdict: "none", stop: null };
  if (
    !Number.isFinite(position?.accuracy) ||
    position.accuracy > AUTO_SELECT_MAX_ACCURACY_METERS
  ) {
    return { verdict: "approximate", stop: closest };
  }
  if (isInsideMultiPolygon(position, serviceBoundary) === false) {
    return { verdict: "outside-area", stop: closest };
  }
  if (closest.distanceMeters > AUTO_SELECT_MAX_DISTANCE_METERS) {
    return { verdict: "far", stop: closest };
  }
  if (nearestChoiceIsAmbiguous(nearby, position.accuracy)) {
    return { verdict: "ambiguous", stop: closest };
  }
  return { verdict: "confident", stop: closest };
}
