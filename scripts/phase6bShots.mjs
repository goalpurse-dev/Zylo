// Phase 6b — screenshots of Step 1's "6 · Voice" card and the voice library
// modal (internal test account only; first-run overlays marked seen).
// No project is created — nothing is clicked past choosing a voice.
//   node --env-file=.env.local scripts/phase6bShots.mjs
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const URL_ = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const admin = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const TEST_USER = "d66a0ea9-3574-4fad-94ed-c82aea15061f";
const { data: u } = await admin.auth.admin.getUserById(TEST_USER);
if (!u?.user?.email?.endsWith("@zyvo-internal.test")) throw new Error("not the internal test user");
const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email: u.user.email });
const client = createClient(URL_, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const { data: sess } = await client.auth.verifyOtp({ type: "magiclink", token_hash: link.properties.hashed_token });
const ref = new URL(URL_).hostname.split(".")[0];
fs.mkdirSync("docs/phase6b", { recursive: true });

const browser = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await browser.newContext({ viewport: { width: 1680, height: 1000 } });
await ctx.addCookies([{ name: "zyvo_cookie_consent", value: "declined", url: "http://localhost:5173" }]);
await ctx.addInitScript(([k, v, w, r]) => { try { localStorage.setItem(k, v); localStorage.setItem(w, "1"); localStorage.setItem(r, "1"); } catch {} },
  [`sb-${ref}-auth-token`, JSON.stringify(sess.session), `zyvo_workspace_welcome:${TEST_USER}`, `zyvo_creator_rewards_seen:${TEST_USER}`]);
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => { errors.push(String(e)); console.log("PAGEERROR", String(e).slice(0, 400)); });
page.on("console", (m) => { if (m.type() === "error") console.log("CONSOLE", m.text().slice(0, 300)); });
await page.goto("http://localhost:5173/long-form/create", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(5000);
if (await page.getByText("Choose your niche").count()) await page.getByText("Choose your niche").click(); else await page.getByText("Change", { exact: true }).first().click();
await page.getByText("Myth vs Reality", { exact: true }).first().click();
await page.waitForTimeout(800);

// 1. The empty voice card + the disabled Generate reason.
const card = page.getByTestId("choose-voice");
await card.scrollIntoViewIfNeeded();
await page.waitForTimeout(400);
await page.screenshot({ path: "docs/phase6b/1-voice-card.png" });
const reason = await page.getByText("Pick a voice to continue").count();

// 2. The library modal (recommended-for-niche first).
await card.click();
await page.getByTestId("voice-library").waitFor();
await page.waitForTimeout(600);
await page.screenshot({ path: "docs/phase6b/2-voice-library.png" });
// Filters: British + Documentary.
await page.getByRole("button", { name: "British" }).click();
await page.getByRole("button", { name: "Documentary" }).click();
await page.waitForTimeout(300);
await page.screenshot({ path: "docs/phase6b/3-library-filtered.png" });
const filtered = await page.locator("[data-voice-id]").count();

// 3. Pick George -> chosen card + summary.
await page.locator('[data-voice-id="JBFqnCBsd6RMkjVDRZzb"]').getByRole("button", { name: "Use this voice" }).click();
await page.waitForTimeout(500);
await page.getByTestId("chosen-voice").scrollIntoViewIfNeeded();
await page.screenshot({ path: "docs/phase6b/4-voice-chosen.png" });
const summary = (await page.getByTestId("summary-voice").count()) ? await page.getByTestId("summary-voice").first().textContent() : null;
console.log(JSON.stringify({ disabledReasonShown: reason > 0, filteredBritishDocumentary: filtered, summary, errors }));
await browser.close();
