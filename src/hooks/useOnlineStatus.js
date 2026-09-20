import { useEffect, useState } from "react";

function currentOnlineState() {
  return typeof navigator === "undefined" ? true : navigator.onLine !== false;
}

export default function useOnlineStatus() {
  const [online, setOnline] = useState(currentOnlineState);

  useEffect(() => {
    const sync = () => setOnline(currentOnlineState());

    // The connection may change between the first render and effect setup,
    // especially while a service worker restores the shell after an offline reload.
    sync();

    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    window.addEventListener("pageshow", sync);
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", sync);

    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
      window.removeEventListener("pageshow", sync);
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);

  return online;
}
