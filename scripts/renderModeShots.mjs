// $0: viewport screenshots + layout numbers of key pages from a built dist/
// served locally, to compare before/after a site-wide rendering change (the
// doctype). App pages use the internal test account (read-only viewing).
//   node --env-file=.env.local scripts/renderModeShots.mjs <outDir> [origin]
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const [OUT, ORIGIN = "http://localhost:4321"] = process.argv.slice(2);
const TEST_USER = "d66a0ea9-3574-4fad-94ed-c82aea15061f";
const PROJECT = "f6ee3eb2-726b-4faa-9d25-1ed957eb46ae"; // the test account's Vikings video
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: u } = await admin.auth.admin.getUserById(TEST_USER);
if (!u?.user?.email?.endsWith("@zyvo-internal.test")) throw new Error("not the internal test user");
const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email: u.user.email });
const anon = createClient(process.env.SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const { data: sess } = await anon.auth.verifyOtp({ type: "magiclink", token_hash: link.properties.hashed_token });
const ref = new URL(process.env.SUPABASE_URL).hostname.split(".")[0];
fs.mkdirSync(OUT, { recursive: true });

const ROUTES = [
  ["home", "/workspace/home", true], ["lobby", "/long-form", true], ["create", "/long-form/create", true], ["project", `/long-form/project/${PROJECT}`, true],
  ["creations", "/workspace/creations", true], ["image-gen", "/workspace/image-generator", true], ["fruit", "/workspace/ai-fruit-story", true], ["pricing", "/workspace/pricing", true],
  ["pricing-out", "/workspace/pricing", false], ["landing", "/ai-stickman-video-generator", false], ["kit-swap", "/kit-swap-ai", false], ["blog", "/blog", false],
  ["blog-post", "/blog/faceless-youtube-channel-ideas", false], ["home-out", "/workspace/home", false],
];
const browser = await chromium.launch({ channel: "chrome" });
const report = {};
for (const [size, viewport, mobile] of [["1366", { width: 1366, height: 900 }, false], ["390", { width: 390, height: 844 }, true]]) {
  for (const signedIn of [true, false]) {
    const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, reducedMotion: "reduce" });
    await ctx.addCookies([{ name: "zyvo_cookie_consent", value: "declined", url: ORIGIN }]);
    if (signedIn) await ctx.addInitScript(([k, v, a, b]) => { try { localStorage.setItem(k, v); localStorage.setItem(a, "1"); localStorage.setItem(b, "1"); } catch {} },
      [`sb-${ref}-auth-token`, JSON.stringify(sess.session), `zyvo_workspace_welcome:${TEST_USER}`, `zyvo_creator_rewards_seen:${TEST_USER}`]);
    for (const [name, path] of ROUTES.filter((r) => r[2] === signedIn)) {
      const page = await ctx.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message.slice(0, 120)));
      await page.goto(`${ORIGIN}${path}`, { waitUntil: "load" });
      await page.waitForTimeout(4500);
      const m = await page.evaluate(() => { const root = document.getElementById("root"); return { url: location.pathname, mode: document.compatMode, docH: document.documentElement.scrollHeight, rootH: root?.scrollHeight ?? null, rootW: root?.scrollWidth ?? null, bodyW: document.body.scrollWidth, h1: document.querySelector("h1")?.getBoundingClientRect().top ?? null }; });
      await page.screenshot({ path: `${OUT}/${name}-${size}.png` });
      report[`${name}-${size}`] = { ...m, errors };
      await page.close();
    }
    await ctx.close();
  }
}
await browser.close();
fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 1));
console.log(Object.entries(report).map(([k, v]) => `${k} ${v.url} ${v.mode} doc ${v.docH} root ${v.rootH}x${v.rootW} h1@${v.h1 == null ? "-" : Math.round(v.h1)}${v.errors.length ? " ERR " + v.errors[0] : ""}`).join("\n"));
