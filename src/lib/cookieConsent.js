// The cookie banner's answer (components/CookieConsent.jsx), for code that has
// to wait for it: the "What's new" popup only opens once the banner is closed.
export const COOKIE_CONSENT_COOKIE = "zyvo_cookie_consent";
// Fired on window when the banner is answered.
export const COOKIE_CONSENT_EVENT = "zyvo:cookie-consent";

export function hasCookieConsent() {
  if (typeof document === "undefined") return false;
  return `; ${document.cookie}`.includes(`; ${COOKIE_CONSENT_COOKIE}=`);
}
