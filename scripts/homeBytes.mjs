// Home page weight ($0): loads /workspace/home at 1920x1080 as the internal
// test account, scrolls the whole page so every lazy image/video loads, and
// sums transferred response bytes by type; lists the heaviest files.
//   node --env-file=.env.local scripts/homeBytes.mjs [label]
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const [label = "home"] = process.argv.slice(2);
const TEST_USER = "d66a0ea9-3574-4fad-94ed-c82aea15061f";
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: u } = await admin.auth.admin.getUserById(TEST_USER);
const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email: u.user.email });
const c = createClient(process.env.SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const { data: sess } = await c.auth.verifyOtp({ type: "magiclink", token_hash: link.properties.hashed_token });
const ref = new URL(process.env.SUPABASE_URL).hostname.split(".")[0];
const browser = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
await ctx.addCookies([{ name: "zyvo_cookie_consent", value: "declined", url: "http://localhost:5173" }]);
await ctx.addInitScript(([k, v, a, b]) => { try { localStorage.setItem(k, v); localStorage.setItem(a, "1"); localStorage.setItem(b, "1"); } catch {} },
  [`sb-${ref}-auth-token`, JSON.stringify(sess.session), `zyvo_workspace_welcome:${TEST_USER}`, `zyvo_creator_rewards_seen:${TEST_USER}`]);
const page = await ctx.newPage();
const rows = [];
page.on("requestfinished", async (req) => {
  try {
    const type = req.resourceType();
    if (!["image", "media"].includes(type)) return;
    const res = await req.response();
    let bytes = (await req.sizes()).responseBodySize;
    if (!bytes && res) bytes = Number(res.headers()["content-length"] ?? 0);
    rows.push({ type, bytes, url: req.url() });
  } catch { /* ignore */ }
});
await page.goto("http://localhost:5173/workspace/home", { waitUntil: "domcontentloaded" });
await page.getByTestId("long-form-section").waitFor({ timeout: 60000 });
await page.waitForTimeout(3000);
const firstScreen = rows.reduce((s, r) => s + r.bytes, 0);
for (let y = 0; y < 12000; y += 600) { await page.evaluate((v) => { document.getElementById("workspace-scroll").scrollTop = v; }, y); await page.waitForTimeout(350); }
await page.waitForTimeout(4000);
await browser.close();
const sum = (t) => rows.filter((r) => !t || r.type === t).reduce((s, r) => s + r.bytes, 0);
const mb = (b) => `${(b / 1e6).toFixed(2)} MB`;
console.log(JSON.stringify({ label, requests: rows.length, firstScreen: mb(firstScreen), images: mb(sum("image")), media: mb(sum("media")), total: mb(sum()),
  heaviest: rows.sort((a, b) => b.bytes - a.bytes).slice(0, 14).map((r) => `${(r.bytes / 1024).toFixed(0)} KB ${decodeURIComponent(r.url.replace(/^https?:\/\/[^/]+/, "")).slice(0, 90)}`) }, null, 1));
