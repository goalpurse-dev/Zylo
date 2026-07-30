import { track } from "@vercel/analytics";

/**
 * Thin wrapper around @vercel/analytics' custom-event track() — the only
 * analytics abstraction present in this app. Never throws, never blocks
 * navigation/UI on failure.
 */
export function trackSeoEvent(name, properties = {}) {
  try {
    track(name, properties);
  } catch {
    // analytics must never break the funnel
  }
}
