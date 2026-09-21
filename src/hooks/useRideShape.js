import { useEffect, useRef } from "react";
import { fetchTripShape } from "../api/foliApi";
import { prepareRideShape } from "../utils/rideGeometry";

// Loads the selected trip's GTFS shape and hands back a ref the GPS sampler
// can read synchronously. The ref is deliberately not state: a position
// callback must not wait for a render to know whether map matching is
// possible.
export default function useRideShape({ rideId, enabled, shapeId, onStatus }) {
  const shapeRef = useRef(null);

  useEffect(() => {
    shapeRef.current = null;
    if (!rideId || !enabled || !shapeId) return undefined;

    const controller = new AbortController();

    fetchTripShape(shapeId, controller.signal)
      .then((points) => {
        if (controller.signal.aborted) return;
        const prepared = prepareRideShape(points);

        if (!prepared?.usesGtfsDistance) {
          // Stop distances and shape distances would be on different scales,
          // so map matching is refused. Say so instead of showing "idle".
          onStatus("unavailable");
          return;
        }

        shapeRef.current = prepared;
        onStatus("ready");
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        onStatus("unavailable");
      });

    return () => {
      controller.abort();
      shapeRef.current = null;
    };
  }, [enabled, onStatus, rideId, shapeId]);

  return shapeRef;
}
