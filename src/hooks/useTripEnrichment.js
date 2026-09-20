import { useEffect, useMemo, useState } from "react";
import { fetchTripDetails } from "../api/foliApi";

export default function useTripEnrichment(arrivals = []) {
  const tripKey = useMemo(
    () =>
      [
        ...new Set(
          arrivals
            .map((arrival) => String(arrival?.tripref || "").trim())
            .filter(Boolean)
        ),
      ]
        .slice(0, 10)
        .join("|"),
    [arrivals]
  );
  const [detailsByTripId, setDetailsByTripId] = useState(() => new Map());

  useEffect(() => {
    const tripIds = tripKey ? tripKey.split("|") : [];
    if (tripIds.length === 0) {
      setDetailsByTripId(new Map());
      return undefined;
    }

    const controller = new AbortController();
    let active = true;

    Promise.all(
      tripIds.map(async (tripId) => {
        try {
          return await fetchTripDetails(tripId, controller.signal);
        } catch {
          return null;
        }
      })
    ).then((details) => {
      if (!active || controller.signal.aborted) return;

      setDetailsByTripId(
        new Map(
          details
            .filter(Boolean)
            .map((detail) => [detail.tripId, detail])
        )
      );
    });

    return () => {
      active = false;
      controller.abort();
    };
  }, [tripKey]);

  return detailsByTripId;
}
