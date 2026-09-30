// Idea cards + idea selection check ($0, internal test account). Copies an
// existing batch of ideas (text + their public thumbnail URLs) into one of the
// test account's own discovery sessions — nothing is generated — then opens
// Step 1: every card's picture loads, picking an idea stays on "Get ideas for
// me" (card selected, summary shows it), and "Edit this idea" opens Write my own.
//   node --env-file=.env.local scripts/ideaCardsCheck.mjs <sourceSessionId> <outDir>
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const [SOURCE, OUT] = process.argv.slice(2);
const TEST_USER = "d66a0ea9-3574-4fad-94ed-c82aea15061f";
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: u } = await admin.auth.admin.getUserById(TEST_USER);
if (!u?.user?.email?.endsWith("@zyvo-internal.test")) throw new Error("not the internal test user");
const { data: src } = await admin.from("long_form_discovery_sessions").select("ideas, last_idea_batch_style_id").eq("id", SOURCE).single();
const { data: target } = await admin.from("long_form_discovery_sessions").select("id").eq("user_id", TEST_USER).order("updated_at", { ascending: false }).limit(1).single();
await admin.from("long_form_discovery_sessions").update({ ideas: src.ideas, selected_idea_id: null, last_idea_batch_style_id: src.last_idea_batch_style_id }).eq("id", target.id);
const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email: u.user.email });
const c = createClient(process.env.SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const { data: sess } = await c.auth.verifyOtp({ type: "magiclink", token_hash: link.properties.hashed_token });
const ref = new URL(process.env.SUPABASE_URL).hostname.split(".")[0];
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await ctx.addCookies([{ name: "zyvo_cookie_consent", value: "declined", url: "http://localhost:5173" }]);
const draft = { discoverySessionId: target.id, nicheId: "ancient_humans_prehistory", visualStyleId: src.last_idea_batch_style_id };
await ctx.addInitScript(([k, v, a, b, d]) => { try { localStorage.setItem(k, v); localStorage.setItem(a, "1"); localStorage.setItem(b, "1"); localStorage.setItem("zyvo:long-form:production-setup-draft:v1", d); } catch {} },
  [`sb-${ref}-auth-token`, JSON.stringify(sess.session), `zyvo_workspace_welcome:${TEST_USER}`, `zyvo_creator_rewards_seen:${TEST_USER}`, JSON.stringify(draft)]);
const page = await ctx.newPage();
const bytes = { full: 0, small: 0 };
page.on("response", async (r) => { const url = r.url(); if (!/runware\/images/.test(url)) return; const len = Number(r.headers()["content-length"] ?? 0); if (url.includes("/render/image/")) bytes.small += len; else bytes.full += len; });
await page.goto("http://localhost:5173/long-form/create", { waitUntil: "domcontentloaded" });
await page.getByRole("button", { name: "Get ideas for me" }).first().click({ timeout: 45000 });
await page.waitForTimeout(6000);
const cards = await page.evaluate(() => [...document.querySelectorAll(".zyvo-ideas-scroll > div")].map((card) => {
  const img = card.querySelector("img");
  return { title: card.querySelector("p")?.textContent?.slice(0, 50), loaded: !!(img && img.complete && img.naturalWidth > 0 && getComputedStyle(img).opacity === "1"), src: img?.src?.includes("/render/image/") ? "small" : img ? "full/other" : "none" };
}));
await page.locator(".zyvo-ideas-scroll").screenshot({ path: `${OUT}/ideas-grid.jpg`, type: "jpeg", quality: 84 });
// Pick the rain idea.
await page.locator(".zyvo-ideas-scroll > div", { hasText: "When It Rained" }).first().click();
await page.waitForTimeout(800);
const afterPick = await page.evaluate(() => ({
  ideasTab: document.querySelector('button[aria-pressed="true"]')?.textContent?.trim(),
  selectedLine: document.querySelector('[data-testid="selected-idea"]')?.textContent?.trim(),
  summaryTopic: [...document.querySelectorAll("dt")].find((d) => d.textContent === "Topic")?.nextElementSibling?.textContent,
}));
await page.screenshot({ path: `${OUT}/idea-picked.jpg`, type: "jpeg", quality: 84 });
await page.getByTestId("edit-idea").click();
await page.waitForTimeout(500);
const afterEdit = await page.evaluate(() => ({ tab: document.querySelector('button[aria-pressed="true"]')?.textContent?.trim(), text: document.querySelector("textarea")?.value?.slice(0, 90) }));
await page.screenshot({ path: `${OUT}/idea-edit.jpg`, type: "jpeg", quality: 84 });
await browser.close();
console.log(JSON.stringify({ session: target.id, cards, loaded: cards.filter((x) => x.loaded).length, of: cards.length, bytesKB: { small: Math.round(bytes.small / 1024), full: Math.round(bytes.full / 1024) }, afterPick, afterEdit }, null, 1));
