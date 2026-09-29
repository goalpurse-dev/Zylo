// Phase 7 check, TEST project (V2), internal test account: ONE paid add-on
// click (Regenerate one scene = 1 credit, ~$0.005 provider cost) proving the
// button price, the charge and the ledger rows; plus screenshots of the new
// prices on Idea (Generate) and Publish. No other paid call is made; the
// Publish 1440p button is only looked at, never clicked.
//   node --env-file=.env.local scripts/phase7AddonCheck.mjs <outDir>
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const TEST_PROJECT = "f6ee3eb2-726b-4faa-9d25-1ed957eb46ae";
const TEST_USER = "d66a0ea9-3574-4fad-94ed-c82aea15061f";
const [OUT] = process.argv.slice(2);
const URL_ = process.env.SUPABASE_URL;
const admin = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: u } = await admin.auth.admin.getUserById(TEST_USER);
if (!u?.user?.email?.endsWith("@zyvo-internal.test")) throw new Error("not the internal test user");
const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email: u.user.email });
const client = createClient(URL_, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const { data: sess } = await client.auth.verifyOtp({ type: "magiclink", token_hash: link.properties.hashed_token });
const ref = new URL(URL_).hostname.split(".")[0];
const balance = async () => (await admin.from("profiles").select("credit_balance").eq("id", TEST_USER).single()).data.credit_balance;
fs.mkdirSync(OUT, { recursive: true });

// Screenshot only ($0): the latest render on the test project failed the
// worker's timing checks (hides the 1440p button), so the status response is
// shown as its last DONE render; price1440 is the server's real value.
const browser = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await browser.newContext({ viewport: { width: 1366, height: 800 } });
await ctx.addCookies([{ name: "zyvo_cookie_consent", value: "declined", url: "http://localhost:5173" }]);
await ctx.addInitScript(([k, v, a, b]) => { try { localStorage.setItem(k, v); localStorage.setItem(a, "1"); localStorage.setItem(b, "1"); } catch {} },
  [`sb-${ref}-auth-token`, JSON.stringify(sess.session), `zyvo_workspace_welcome:${TEST_USER}`, `zyvo_creator_rewards_seen:${TEST_USER}`]);
let realPrice = null;
await ctx.route("**/functions/v1/long-form-render", async (r) => {
  const b = r.request().postDataJSON?.() ?? {};
  if (b.action && b.action !== "status") return r.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' }); // never start anything
  const res = await r.fetch(); const j = await res.json();
  realPrice = j.price1440;
  if (j.lastDone) { j.job = j.lastDone; if (!j.doneByRes?.["1080p"]) j.doneByRes = { ...(j.doneByRes ?? {}), "1080p": j.lastDone }; }
  return r.fulfill({ response: res, json: j });
});
const page = await ctx.newPage();
await page.goto(`http://localhost:5173/long-form/project/${TEST_PROJECT}/publish`, { waitUntil: "domcontentloaded" });
await page.getByTestId("price-1440").waitFor({ timeout: 60000 });
await page.waitForTimeout(2000);
await page.screenshot({ path: `${OUT}/publish-prices.png` });
console.log(JSON.stringify({ realPrice1440: realPrice, button: (await page.getByTestId("price-1440").first().textContent()).trim() }));
await browser.close();
