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

const browser = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await browser.newContext({ viewport: { width: 1366, height: 800 } });
await ctx.addCookies([{ name: "zyvo_cookie_consent", value: "declined", url: "http://localhost:5173" }]);
await ctx.addInitScript(([k, v, a, b]) => { try { localStorage.setItem(k, v); localStorage.setItem(a, "1"); localStorage.setItem(b, "1"); } catch {} },
  [`sb-${ref}-auth-token`, JSON.stringify(sess.session), `zyvo_workspace_welcome:${TEST_USER}`, `zyvo_creator_rewards_seen:${TEST_USER}`]);
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
const out = { errors };

// 1. Scenes: the button price, then ONE paid click.
await page.goto(`http://localhost:5173/long-form/project/${TEST_PROJECT}/scenes`, { waitUntil: "domcontentloaded" });
const btn = page.getByTestId("regenerate").first();
await btn.waitFor({ timeout: 60000 });
await page.waitForFunction(() => { const b = document.querySelector("[data-testid=regenerate]"); return b && !b.disabled; }, null, { timeout: 60000 });
out.buttonText = (await btn.textContent()).trim();
const card = btn.locator("xpath=ancestor::*[contains(@class,'rounded')][2]");
await btn.scrollIntoViewIfNeeded();
await (await card.count() ? card : btn).screenshot({ path: `${OUT}/scenes-regenerate-price.png` });
const before = await balance();
const since = new Date().toISOString();
const [resp] = await Promise.all([
  page.waitForResponse((r) => r.url().includes("/functions/v1/update-long-form-scene") && r.request().method() === "POST", { timeout: 60000 }),
  btn.click(),
]);
out.response = { status: resp.status(), body: await resp.json().catch(() => null) };
const afterClick = await balance();
out.balance = { before, afterClick };

// 2. Wait (max 4 min) for the redraw to land, then read its row + ledger rows.
let row = null;
for (let i = 0; i < 48; i++) {
  const { data } = await admin.from("long_form_scene_images").select("id, beat_sequence, version, status, source, addon_credits, credits_charged, cost_usd, created_at")
    .eq("project_id", TEST_PROJECT).gte("created_at", since).order("created_at", { ascending: false }).limit(1).maybeSingle();
  row = data;
  if (row && ["ready", "failed"].includes(row.status)) break;
  await new Promise((r) => setTimeout(r, 5000));
}
out.scene = row;
out.balance.final = await balance();
if (row) {
  const { data: led } = await admin.from("long_form_cost_ledger").select("stage, provider, model, usd, estimated").eq("source_id", row.id).order("created_at");
  out.ledger = led;
}
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/scenes-after.png` });

// 3. Publish: the 1440p price (looked at only).
await page.goto(`http://localhost:5173/long-form/project/${TEST_PROJECT}/publish`, { waitUntil: "domcontentloaded" });
await page.getByTestId("render-card").waitFor({ timeout: 60000 }).catch(() => {});
await page.getByTestId("price-1440").waitFor({ timeout: 30000 }).catch(() => {});
await page.waitForTimeout(1500);
out.price1440 = (await page.getByTestId("price-1440").count()) ? (await page.getByTestId("price-1440").first().textContent()).trim() : null;
await page.screenshot({ path: `${OUT}/publish-prices.png` });

// 4. Idea (Generate): tier cards + fixed price on the Generate button.
await page.goto("http://localhost:5173/long-form/create", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(5000);
if (await page.getByText("Choose your niche").count()) await page.getByText("Choose your niche").click(); else await page.getByText("Change", { exact: true }).first().click();
await page.getByText("Myth vs Reality", { exact: true }).first().click();
await page.waitForTimeout(800);
await page.getByRole("button", { name: /V2 Fast/ }).click();
await page.waitForTimeout(2500);
out.tierCards = await Promise.all(["v2", "v3", "v4"].map(async (t) => (await page.getByTestId(`tier-price-${t}`).textContent()).trim()));
await page.getByTestId("tier-price-v2").scrollIntoViewIfNeeded();
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/idea-generate-prices.png` });
out.generateButton = await page.evaluate(() => [...document.querySelectorAll("button")].map((b) => b.textContent.replace(/\s+/g, " ").trim()).find((t) => /^Generate video/.test(t)) ?? null);

console.log(JSON.stringify(out, null, 1));
await browser.close();
