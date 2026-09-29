// Editor voiceover waveform check ($0): the TEST project's editor as the internal
// test account; optionally with its audio swapped (in the browser) for another
// public narration file. Reports whether the waveform canvas has pixels + errors.
//   node --env-file=.env.local scripts/waveformCheck.mjs <outDir> [audioUrl]
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const TEST_PROJECT = "f6ee3eb2-726b-4faa-9d25-1ed957eb46ae";
const [OUT, AUDIO] = process.argv.slice(2);
const URL_ = process.env.SUPABASE_URL;
const admin = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const TEST_USER = "d66a0ea9-3574-4fad-94ed-c82aea15061f";
const { data: u } = await admin.auth.admin.getUserById(TEST_USER);
if (!u?.user?.email?.endsWith("@zyvo-internal.test")) throw new Error("not the internal test user");
const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email: u.user.email });
const client = createClient(URL_, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const { data: sess } = await client.auth.verifyOtp({ type: "magiclink", token_hash: link.properties.hashed_token });
const ref = new URL(URL_).hostname.split(".")[0];
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await browser.newContext({ viewport: { width: 1366, height: 800 } });
await ctx.addCookies([{ name: "zyvo_cookie_consent", value: "declined", url: "http://localhost:5173" }]);
await ctx.addInitScript(([k, v, a, b]) => { try { localStorage.setItem(k, v); localStorage.setItem(a, "1"); localStorage.setItem(b, "1"); } catch {} },
  [`sb-${ref}-auth-token`, JSON.stringify(sess.session), `zyvo_workspace_welcome:${TEST_USER}`, `zyvo_creator_rewards_seen:${TEST_USER}`]);
// Read-only: saves are blocked; the audio URL is swapped when asked.
await ctx.route("**/functions/v1/long-form-edit", async (r) => {
  const b = r.request().postDataJSON?.() ?? {};
  if (b.action === "save") return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, version: b.baseVersion ?? 1 }) });
  const res = await r.fetch(); const j = await res.json();
  if (AUDIO && j?.doc?.audio) j.doc.audio.url = AUDIO;
  return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(j) });
});
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 200)); });
const t0 = Date.now();
await page.goto(`http://localhost:5173/long-form/project/${TEST_PROJECT}/edit`, { waitUntil: "domcontentloaded" });
await page.getByTestId("edit-timeline").waitFor({ timeout: 90000 });
const res = await page.waitForFunction(() => {
  const c = [...document.querySelectorAll("[data-testid=edit-timeline] [data-testid=wave-tile]")][0];
  if (!c || !c.width) return null;
  const g = c.getContext("2d"); const d = g.getImageData(0, 0, Math.min(c.width, 4000), c.height).data;
  let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
  return n > 0 ? { w: c.width, h: c.height, lit: n } : null;
}, null, { timeout: 60000 }).then((h) => h.jsonValue()).catch(() => null);
await page.screenshot({ path: `${OUT}/editor-waveform${AUDIO ? "-f90160bc-audio" : ""}.png` });
console.log(JSON.stringify({ audio: AUDIO ? "swapped" : "own", canvas: res, seconds: Math.round((Date.now() - t0) / 1000), errors: errors.slice(0, 5) }));
await browser.close();
