// Phase 6a — clean screenshots of a running/finished Stickman autopilot
// project (session + first-run overlays marked seen: welcome, creator
// rewards, cookie banner). Usage: node --env-file=.env.local scripts/phase6aShots.mjs <projectId> <page> <outName> [waitMs]
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const [projectId, pageName, outName, waitMs = "4000"] = process.argv.slice(2);
const URL_ = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const admin = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const TEST_USER = "d66a0ea9-3574-4fad-94ed-c82aea15061f";
const { data: u } = await admin.auth.admin.getUserById(TEST_USER);
if (!u?.user?.email?.endsWith("@zyvo-internal.test")) throw new Error("not the internal test user");
const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email: u.user.email });
const client = createClient(URL_, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const { data: sess } = await client.auth.verifyOtp({ type: "magiclink", token_hash: link.properties.hashed_token });
const ref = new URL(URL_).hostname.split(".")[0];
const browser = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await ctx.addCookies([{ name: "zyvo_cookie_consent", value: "declined", url: "http://localhost:5173" }]);
await ctx.addInitScript(([k, v, w, r]) => { try { localStorage.setItem(k, v); localStorage.setItem(w, "1"); localStorage.setItem(r, "1"); } catch {} },
  [`sb-${ref}-auth-token`, JSON.stringify(sess.session), `zyvo_workspace_welcome:${TEST_USER}`, `zyvo_creator_rewards_seen:${TEST_USER}`]);
const page = await ctx.newPage();
await page.goto(`http://localhost:5173/long-form/project/${projectId}/${pageName}`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(Number(waitMs));
await page.screenshot({ path: `docs/phase6a/${outName}.png`, fullPage: process.argv.includes("--full") });
console.log(`saved docs/phase6a/${outName}.png at ${page.url()}`);
await browser.close();
