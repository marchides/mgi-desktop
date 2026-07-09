import { useEffect, useState } from "react";

/**
 * Small offline indicator. Renders nothing when online (avoids SSR hydration
 * mismatch by defaulting to online and reading navigator.onLine in useEffect).
 */
export function OfflineBanner() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  if (online) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-50 w-full bg-amber-500/95 px-3 py-1.5 text-center text-xs font-medium text-black shadow-sm"
    >
      You are offline. Chat requires internet.
    </div>
  );
}
