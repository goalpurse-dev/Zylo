// The site's own origins: the only places Stripe may send a customer back to
// (checkout success/cancel, billing portal return). Shared by
// create-checkout-session and create-portal-session.

export const DEFAULT_APP_ORIGIN = "https://www.tryzyvo.com";

const SITE_ORIGINS = new Set(["https://www.tryzyvo.com", "https://tryzyvo.com"]);
// Local development (npm run dev / preview) against the deployed functions.
const LOCAL_DEV = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

/** extra: more allowed origins (the APP_ORIGIN secret, when set). */
export function isAllowedAppOrigin(origin, extra = []) {
  return SITE_ORIGINS.has(origin) || LOCAL_DEV.test(origin) || extra.includes(origin);
}

/** "https://x.y/path" → "https://x.y", or null when it is not a URL. */
export function originOf(value) {
  try { return new URL(String(value)).origin; } catch { return null; }
}

/** The origin to build return URLs on: the caller's, when it is ours. */
export function appOriginFor(requestOrigin, extra = []) {
  return requestOrigin && isAllowedAppOrigin(requestOrigin, extra) ? requestOrigin : DEFAULT_APP_ORIGIN;
}

/** The URL as given when it is an absolute URL on one of our origins, else null. */
export function allowedAppUrl(candidate, extra = []) {
  if (typeof candidate !== "string" || !candidate) return null;
  const origin = originOf(candidate);
  return origin && isAllowedAppOrigin(origin, extra) ? candidate : null;
}

/**
 * An in-app return path ("/settings?from=portal") → absolute URL on `origin`,
 * only when its pathname is in allowedPaths; anything else → fallbackPath.
 * "//evil.com" and absolute URLs resolve to another origin and are refused.
 */
export function allowedReturnUrl(returnPath, origin, allowedPaths, fallbackPath) {
  try {
    if (typeof returnPath === "string" && returnPath.startsWith("/")) {
      const url = new URL(returnPath, origin);
      if (url.origin === origin && allowedPaths.includes(url.pathname)) return url.toString();
    }
  } catch { /* fall through */ }
  return new URL(fallbackPath, origin).toString();
}

/** Adds ?session_id={CHECKOUT_SESSION_ID} (Stripe fills it in) unless the URL already carries the placeholder. */
export function withCheckoutSessionId(url) {
  if (url.includes("{CHECKOUT_SESSION_ID}")) return url;
  const [base, hash = ""] = url.split("#");
  return `${base}${base.includes("?") ? "&" : "?"}session_id={CHECKOUT_SESSION_ID}${hash ? `#${hash}` : ""}`;
}
