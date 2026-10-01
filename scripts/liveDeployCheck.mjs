// Live check after a frontend deploy ($0, internal test account, production
// tryzyvo.com): Home, the "What's new" popup (the account has Long Form projects,
// so only the popup's project-count check is answered with 0), the Long Form
// lobby, /unsubscribe with a signed link (then Undo) and the email hero image.
// The account's seen_announcements and email_updates are restored at the end.
//   node --env-file=.env.local scripts/liveDeployCheck.mjs <outDir> [origin]
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";
import { unsubscribeLinks } from "../emails/unsubscribeLink.js";

const [OUT, ORIGIN = "https://tryzyvo.com"] = process.argv.slice(2);
const TEST_USER = "d66a0ea9-3574-4fad-94ed-c82aea15061f";
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: u } = await admin.auth.admin.getUserById(TEST_USER);
if (!u?.user?.email?.endsWith("@zyvo-internal.test")) throw new Error("not the internal test user");
const { data: before } = await admin.from("profiles").select("seen_announcements, email_updates").eq("id", TEST_USER).single();
const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email: u.user.email });
const c = createClient(process.env.SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const { data: sess } = await c.auth.verifyOtp({ type: "magiclink", token_hash: link.properties.hashed_token });
const ref = new URL(process.env.SUPABASE_URL).hostname.split(".")[0];
fs.mkdirSync(OUT, { recursive: true });
const out = {};
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  await admin.from("profiles").update({ seen_announcements: [], email_updates: true }).eq("id", TEST_USER);
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  // The site serves from www.: the consent cookie on both hosts.
  await ctx.addCookies(["https://tryzyvo.com", "https://www.tryzyvo.com", ORIGIN].map((url) => ({ name: "zyvo_cookie_consent", value: "declined", url })));
  await ctx.addInitScript(([k, v, a, b]) => { try { localStorage.setItem(k, v); localStorage.setItem(a, "1"); localStorage.setItem(b, "1"); } catch {} },
    [`sb-${ref}-auth-token`, JSON.stringify(sess.session), `zyvo_workspace_welcome:${TEST_USER}`, `zyvo_creator_rewards_seen:${TEST_USER}`]);
  await ctx.route("**/rest/v1/long_form_projects*", (r) => r.request().method() === "HEAD"
    ? r.fulfill({ status: 200, headers: { "content-range": "*/0", "access-control-expose-headers": "Content-Range" }, body: "" }) : r.continue());
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
  // Home + popup
  await page.goto(`${ORIGIN}/workspace/home`);
  out.popup = await page.getByTestId("whats-new").waitFor({ timeout: 30000 }).then(() => true, () => false);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/live-popup.jpg`, type: "jpeg", quality: 82 });
  if (out.popup) await page.getByRole("button", { name: "Close" }).click();
  await page.waitForTimeout(1500);
  out.home = { pathCards: await page.getByTestId("path-long").isVisible(), whatsNew: await page.getByTestId("whats-new-row").isVisible() };
  await page.screenshot({ path: `${OUT}/live-home.jpg`, type: "jpeg", quality: 82 });
  // Long Form lobby
  await page.goto(`${ORIGIN}/long-form`);
  out.lobby = await page.getByTestId("create-card").waitFor({ timeout: 30000 }).then(() => true, () => false);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${OUT}/live-lobby.jpg`, type: "jpeg", quality: 82 });
  // /unsubscribe (signed link) -> unsubscribed, then Undo
  const { pageUrl } = unsubscribeLinks(TEST_USER, { secret: process.env.EMAIL_UNSUBSCRIBE_SECRET, supabaseUrl: process.env.SUPABASE_URL, app: ORIGIN });
  await page.goto(pageUrl);
  const unsub = await page.getByText("You're unsubscribed").waitFor({ timeout: 30000 }).then(() => true, () => false);
  const afterOpen = (await admin.from("profiles").select("email_updates").eq("id", TEST_USER).single()).data.email_updates;
  await page.screenshot({ path: `${OUT}/live-unsubscribe.jpg`, type: "jpeg", quality: 82 });
  await page.getByRole("button", { name: /Undo/ }).click().catch(() => {});
  const undo = await page.getByText("You're subscribed again").waitFor({ timeout: 15000 }).then(() => true, () => false);
  out.unsubscribe = { shown: unsub, emailUpdatesAfterOpen: afterOpen, undo };
  // Hero image
  const hero = await fetch(`${ORIGIN}/email/long-form-hero.png`, { cache: "no-store" });
  out.hero = { status: hero.status, type: hero.headers.get("content-type"), kb: Math.round((await hero.arrayBuffer()).byteLength / 1024) };
  out.pageErrors = errors;
  await ctx.close();
} finally {
  await browser.close();
  await admin.from("profiles").update({ seen_announcements: before.seen_announcements, email_updates: before.email_updates }).eq("id", TEST_USER);
}
const { data: after } = await admin.from("profiles").select("seen_announcements, email_updates").eq("id", TEST_USER).single();
out.restored = JSON.stringify(after) === JSON.stringify(before);
console.log(JSON.stringify(out, null, 1));
