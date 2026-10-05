import { useCallback, useEffect, useState } from "react";

/**
 * A countdown in whole seconds: start(seconds) begins it, secondsLeft reaches 0
 * when the wait is over. Counts against the clock, so a tab left in the
 * background comes back with the right number.
 */
export function useCooldown(initialSeconds = 0) {
  const [until, setUntil] = useState(() => (initialSeconds > 0 ? Date.now() + initialSeconds * 1000 : 0));
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (until <= Date.now()) return undefined;
    setNow(Date.now());
    const timer = setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= until) clearInterval(timer);
    }, 250);
    return () => clearInterval(timer);
  }, [until]);

  const start = useCallback((seconds) => setUntil(Date.now() + Math.max(0, seconds) * 1000), []);
  return { secondsLeft: Math.max(0, Math.ceil((until - now) / 1000)), start };
}
