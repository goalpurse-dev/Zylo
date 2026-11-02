// Zyvo Studio capture: a real logged-in browser on the LIVE app as the internal content-machine account, for sharp
// screenshots (deviceScaleFactor 3) and recordings of the real flow. No email is sent: the session comes from an admin
// magic-link token, and the account's address is suppressed. Shared by the capture scripts.
import { createRequire } from "node:module";
import { userSession, SUPABASE_URL } from "file:///C:/Users/Public/Zylo/scripts/blocky/lib.mjs";

export const SITE = "https://www.tryzyvo.com";
export const INTERNAL_EMAIL = "content-machine@tryzyvo.com";
const REF = new URL(SUPABASE_URL).hostname.split(".")[0];
const { chromium } = createRequire("C:/Users/Public/Zylo/package.json")("playwright");

/** A browser context logged in as the internal account (desktop 1280x860 at 3x unless told otherwise). */
export async function openApp({ width = 1280, height = 860, scale = 3, video = null } = {}) {
  const s = await userSession(INTERNAL_EMAIL);
  const { data } = await s.client.auth.getSession();   // the whole session (access + refresh token, user), as supabase-js stores it
  const session = data.session;
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: scale, ...(video ? { recordVideo: { dir: video, size: { width, height } } } : {}) });
  await ctx.addInitScript(([key, value]) => {
    try { localStorage.setItem(key, value); localStorage.setItem("zyvo_cookie_consent", "declined"); } catch { /* */ }
  }, [`sb-${REF}-auth-token`, JSON.stringify(session)]);
  const page = await ctx.newPage();
  return { browser, ctx, page, session };
}

/** The visible buttons and links (text, enabled), to decide the next click without guessing. */
export async function visibleControls(page) {
  return page.evaluate(() => [...document.querySelectorAll("button, a[href], [role=button], [role=tab], [role=switch], input, select, textarea")]
    .filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== "hidden"; })
    .map((e) => `${e.tagName.toLowerCase()}${e.disabled ? "[disabled]" : ""} "${(e.innerText || e.value || e.getAttribute("aria-label") || e.getAttribute("placeholder") || "").trim().replace(/\s+/g, " ").slice(0, 70)}"`)
    .filter((t, i, a) => a.indexOf(t) === i));
}
