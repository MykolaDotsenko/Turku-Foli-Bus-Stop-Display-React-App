import { useCallback, useEffect, useRef, useState } from "react";
import { fetchScheduledLineDepartures } from "../api/foliApi";

// The next timetable departures of followed lines that the live board has
// no row for. Asked once per stop and set of lines, again once the first
// departure it gave has left, and again on request.
export default function useLineTimetable(stopId, lines, referenceTime) {
  const key =
    stopId && lines.length > 0 ? `${stopId}|${[...lines].sort().join(",")}` : "";
  const [answer, setAnswer] = useState({ key: "", status: "idle", rows: [] });
  const [attempt, setAttempt] = useState(0);
  const referenceRef = useRef(referenceTime);
  referenceRef.current = referenceTime;

  const current = answer.key === key;
  const firstLeaves = current ? answer.rows[0]?.aimeddeparturetime : undefined;
  // Changes only when that first departure has gone, not on every tick.
  const firstGone =
    Number.isFinite(firstLeaves) && Number(referenceTime) > firstLeaves + 30
      ? firstLeaves
      : 0;

  useEffect(() => {
    if (!key) return undefined;
    const [id, joined] = key.split("|");
    const controller = new AbortController();

    setAnswer((previous) => ({
      key,
      status: "loading",
      rows: previous.key === key ? previous.rows : [],
    }));
    fetchScheduledLineDepartures(
      id,
      joined.split(","),
      referenceRef.current,
      controller.signal
    )
      .then((rows) => {
        if (!controller.signal.aborted) setAnswer({ key, status: "ready", rows });
      })
      .catch(() => {
        if (!controller.signal.aborted) setAnswer({ key, status: "error", rows: [] });
      });

    return () => controller.abort();
  }, [key, firstGone, attempt]);

  const retry = useCallback(() => setAttempt((count) => count + 1), []);

  return {
    status: !key ? "idle" : current ? answer.status : "loading",
    rows: current ? answer.rows : [],
    retry,
  };
}
