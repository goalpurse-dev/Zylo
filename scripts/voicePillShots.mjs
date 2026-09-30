// Voice library "Recommended" pill check ($0, internal test account): opens
// the library from Step 1 (nothing is generated) at 1920 / 1366 / 390 and
// checks every pill is one line on its own row, and the button stays centered.
//   node --env-file=.env.local scripts/voicePillShots.mjs <outDir>
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const [OUT] = process.argv.slice(2);
const TEST_USER = "d66a0ea9-3574-4fad-94ed-c82aea15061f";
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: u } = await admin.auth.admin.getUserById(TEST_USER);
if (!u?.user?.email?.endsWith("@zyvo-internal.test")) throw new Error("not the internal test user");
const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email: u.user.email });
const c = createClient(process.env.SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const { data: sess } = await c.auth.verifyOtp({ type: "magiclink", token_hash: link.properties.hashed_token });
const ref = new URL(process.env.SUPABASE_URL).hostname.split(".")[0];
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const out = {};
for (const [w, h, mobile] of [[1920, 1080, false], [1366, 768, false], [390, 844, true]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile });
  await ctx.addCookies([{ name: "zyvo_cookie_consent", value: "declined", url: "http://localhost:5173" }]);
  await ctx.addInitScript(([k, v, a, b]) => { try { localStorage.setItem(k, v); localStorage.setItem(a, "1"); localStorage.setItem(b, "1"); } catch {} },
    [`sb-${ref}-auth-token`, JSON.stringify(sess.session), `zyvo_workspace_welcome:${TEST_USER}`, `zyvo_creator_rewards_seen:${TEST_USER}`]);
  const page = await ctx.newPage();
  await page.goto("http://localhost:5173/long-form/create", { waitUntil: "domcontentloaded" });
  const opener = page.locator('[data-testid="choose-voice"]:visible, [data-testid="chosen-voice"]:visible').first();
  await opener.waitFor({ timeout: 45000 });
  // The voice card unlocks once a niche is picked (UI only).
  if (await opener.isDisabled()) {
    const pick = page.getByText("Choose your niche").first();
    if (await pick.count()) await pick.click(); else await page.getByText("Change", { exact: true }).first().click();
    await page.getByText("Myth vs Reality", { exact: true }).first().click();
    await page.waitForTimeout(800);
  }
  await opener.scrollIntoViewIfNeeded();
  await opener.click();
  await page.getByTestId("voice-library").waitFor();
  await page.waitForTimeout(700);
  out[w] = await page.getByTestId("voice-library").evaluate((dlg) => {
    const cards = [...dlg.querySelectorAll("li[data-voice-id]")];
    const rows = cards.map((li) => {
      const pill = li.querySelector('[data-testid="voice-recommended"]');
      const tags = pill?.nextElementSibling;
      const btn = li.querySelector(":scope > button:last-of-type"); // "Use this voice" (the play button comes first)
      const lb = li.getBoundingClientRect(), bb = btn.getBoundingClientRect();
      const pb = pill?.getBoundingClientRect(), tb = tags?.getBoundingClientRect();
      return {
        pill: !!pill,
        oneLine: pill ? pb.height <= 22 : null,
        ownRow: pill ? (!tb || tb.top >= pb.bottom - 0.5) : null,
        title: pill?.getAttribute("title") ?? null,
        buttonCenterOff: Math.abs((bb.top + bb.bottom) / 2 - (lb.top + lb.bottom) / 2),
      };
    });
    const withPill = rows.filter((r) => r.pill);
    return {
      cards: rows.length, withPill: withPill.length,
      allOneLine: withPill.every((r) => r.oneLine), allOwnRow: withPill.every((r) => r.ownRow),
      tooltip: withPill[0]?.title, maxButtonCenterOffPx: +Math.max(...rows.map((r) => r.buttonCenterOff)).toFixed(1),
    };
  });
  await page.getByTestId("voice-library").screenshot({ path: `${OUT}/voices-${w}.jpg`, type: "jpeg", quality: 86 });
  await ctx.close();
}
await browser.close();
console.log(JSON.stringify(out, null, 1));
