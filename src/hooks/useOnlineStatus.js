import { useEffect, useState } from "react";

function currentOnlineState() {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

export default function useOnlineStatus() {
  const [online, setOnline] = useState(currentOnlineState);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return online;
}
