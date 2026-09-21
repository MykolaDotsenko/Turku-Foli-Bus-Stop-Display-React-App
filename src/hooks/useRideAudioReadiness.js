import { useEffect } from "react";
import { primeRideVoices, unlockRideAudio } from "../utils/rideAlerts";

// Two things are dead on arrival unless they are prepared before the alarm
// needs them. Autoplay policy leaves the audio context suspended on a fresh
// page load, and a ride restored after a reload never runs the start-up test
// alert that would have unlocked it — so every tone for the rest of the ride
// is silently dropped. The speech engine's voice list is likewise empty until
// it fires `voiceschanged`, which is after the first thing we ask it to say.
export default function useRideAudioReadiness(rideId) {
  useEffect(() => {
    if (!rideId) return undefined;

    let active = true;

    const detach = () => {
      document.removeEventListener("pointerdown", tryUnlock);
      document.removeEventListener("keydown", tryUnlock);
    };

    async function tryUnlock() {
      const unlocked = await unlockRideAudio();
      if (unlocked && active) detach();
    }

    primeRideVoices();
    void tryUnlock();
    document.addEventListener("pointerdown", tryUnlock);
    document.addEventListener("keydown", tryUnlock);

    return () => {
      active = false;
      detach();
    };
  }, [rideId]);
}
