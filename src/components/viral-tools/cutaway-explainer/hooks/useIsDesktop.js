import { useSyncExternalStore } from "react";

// The desktop layout starts at Tailwind's lg (1024 px), like the other short-form templates. The studio mounts ONE
// layout from this, never both with one hidden by CSS: a hidden layout would mount (and autoplay) a second player.
export const DESKTOP_QUERY = "(min-width: 1024px)";

const subscribe = (onChange) => {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mq = window.matchMedia(DESKTOP_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
};
const snapshot = () => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia(DESKTOP_QUERY).matches : true);

export default function useIsDesktop() {
  return useSyncExternalStore(subscribe, snapshot, () => true);
}
