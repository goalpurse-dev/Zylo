// Phase 6c-polish ($0): screenshots of the new Scenes step on the Myth vs
// Reality test project — review + player (with a text-layer scene playing),
// the card grid, the drawing screen (replayed fill) and the Edit placeholder.
//   node --env-file=.env.local scripts/phase6cPolishShots.mjs
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const PROJECT = "f6ee3eb2-726b-4faa-9d25-1ed957eb46ae";
const URL_ = process.env.SUPABASE_URL;
const admin = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const TEST_USER = "d66a0ea9-3574-4fad-94ed-c82aea15061f";
const { data: u } = await admin.auth.admin.getUserById(TEST_USER);
if (!u?.user?.email?.endsWith("@zyvo-internal.test")) throw new Error("not the internal test user");
const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email: u.user.email });
const client = createClient(URL_, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const { data: sess } = await client.auth.verifyOtp({ type: "magiclink", token_hash: link.properties.hashed_token });
const ref = new URL(URL_).hostname.split(".")[0];
fs.mkdirSync("docs/phase6c/polish", { recursive: true });
const OUT = "docs/phase6c/polish";

const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--autoplay-policy=no-user-gesture-required"] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
await ctx.addCookies([{ name: "zyvo_cookie_consent", value: "declined", url: "http://localhost:5173" }]);
await ctx.addInitScript(([k, v, w, r, pid]) => { try { localStorage.setItem(k, v); localStorage.setItem(w, "1"); localStorage.setItem(r, "1"); localStorage.removeItem(`zyvo_scenes_celebrated:${pid}`); } catch {} },
  [`sb-${ref}-auth-token`, JSON.stringify(sess.session), `zyvo_workspace_welcome:${TEST_USER}`, `zyvo_creator_rewards_seen:${TEST_USER}`, PROJECT]);
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
const out = {};

await page.goto(`http://localhost:5173/long-form/project/${PROJECT}/scenes`, { waitUntil: "domcontentloaded" });
await page.getByTestId("stickman-player").waitFor({ timeout: 30000 });
await page.waitForTimeout(3500);
await page.screenshot({ path: `${OUT}/1-review-ready.png` });
out.counts = await page.getByTestId("scenes-counts").textContent();
out.cards = await page.getByTestId("scene-card").count();
out.innerScrollBoxes = await page.evaluate(() => [...document.querySelectorAll("[data-testid=scenes-list] *")].filter((el) => ["auto", "scroll"].includes(getComputedStyle(el).overflowY)).length);
out.firstSummaries = await page.locator("[data-testid=scene-card] p.line-clamp-1").evaluateAll((els) => els.slice(0, 6).map((e) => e.textContent));

// Click scene 26's card ("NORWAY 1943" text layer) -> the player jumps there and plays.
await page.getByRole("button", { name: "Play from scene 26", exact: true }).click();
await page.waitForTimeout(2500);
out.playerTimeAfterClick = await page.evaluate(() => document.querySelector("[data-testid=stickman-player] audio").currentTime.toFixed(2));
await page.evaluate(() => document.querySelector("[data-testid=stickman-player] audio").pause());
await page.waitForTimeout(500);
await page.getByTestId("stickman-player").screenshot({ path: `${OUT}/2-player-scene26-text-layer.png` });

// The card grid (page scroll only).
await page.getByTestId("scenes-list").scrollIntoViewIfNeeded();
await page.evaluate(() => document.getElementById("workspace-scroll")?.scrollBy(0, 250));
await page.waitForTimeout(2500);
await page.screenshot({ path: `${OUT}/3-review-grid.png` });

// Drawing screen: the replayed fill.
await page.goto(`http://localhost:5173/long-form/project/${PROJECT}/scenes?replay=1`, { waitUntil: "domcontentloaded" });
await page.getByTestId("scenes-grid").waitFor({ timeout: 30000 });
await page.waitForTimeout(6500);
out.replayCounter = await page.getByTestId("scenes-counter").textContent();
await page.screenshot({ path: `${OUT}/4-drawing-live-fill.png` });

// Edit placeholder via the bottom bar.
await page.goto(`http://localhost:5173/long-form/project/${PROJECT}/scenes`, { waitUntil: "domcontentloaded" });
await page.getByTestId("stickman-player").waitFor({ timeout: 30000 });
await page.getByRole("button", { name: /Continue to Edit/ }).click();
await page.getByTestId("edit-placeholder").waitFor({ timeout: 15000 });
out.editUrl = page.url().split("/").slice(-1)[0];
await page.screenshot({ path: `${OUT}/5-edit-placeholder.png` });
out.errors = errors;
console.log(JSON.stringify(out, null, 1));
await browser.close();
