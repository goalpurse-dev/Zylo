// Mobile editor check ($0): the Edit page on phones (touch emulation) at
// 360x740, 390x844, 414x896 and 768x1024, with a real user's project served
// READ-ONLY into the internal test account's page (nothing is written):
// default view, the Text sheet, a scene selected (context toolbar). Measures
// page-level horizontal scroll, toolbar vs bottom-nav overlap, touch targets.
// Also: desktop 1920 with a cut selected (transition picker) after Auto mix.
//   node --env-file=.env.local scripts/mobileEditorShots.mjs <outDir> <projectId> <seconds>
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";
import { loadEditFor } from "./lib/editRead.mjs";

const TEST_PROJECT = "f6ee3eb2-726b-4faa-9d25-1ed957eb46ae";
const [OUT, SHOW, SEC] = process.argv.slice(2);
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
const served = await loadEditFor(admin, SHOW);
// sections/reveals for Auto mix, read-only
const { data: p } = await admin.from("long_form_projects").select("autopilot, current_script_version_id").eq("id", SHOW).single();
const { data: sv } = await admin.from("long_form_script_versions").select("script_document").eq("id", p.current_script_version_id).single();
const { data: beats } = await admin.from("long_form_beats").select("sequence, start_word, contract").eq("beat_plan_version_id", p.autopilot.scenes.planId);
const segs = sv.script_document.narrationSegments ?? [];
const chOf = new Map(); for (const ch of sv.script_document.chapters ?? []) for (const id of ch.segmentIds ?? []) chOf.set(id, ch.chapterId);
let acc = 0; const segStart = segs.map((s) => { const a = acc; acc += String(s.text).split(/\s+/).filter(Boolean).length; return a; });
served.sections = Object.fromEntries(beats.map((b) => { let k = 0; for (let i = 0; i < segs.length; i++) if (segStart[i] <= (b.start_word ?? 0)) k = i; return [b.sequence, chOf.get(segs[k]?.id) ?? "main"]; }));
served.reveals = beats.filter((b) => b.contract?.textIntent?.category === "REVEAL").map((b) => b.sequence);
console.log("served", JSON.stringify(served._check), "sections", new Set(Object.values(served.sections)).size, "reveals", served.reveals.length);

const browser = await chromium.launch({ channel: "chrome", headless: true });
async function open(viewport, mobile) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
  await ctx.addCookies([{ name: "zyvo_cookie_consent", value: "declined", url: "http://localhost:5173" }]);
  await ctx.addInitScript(([k, v, a, b]) => { try { localStorage.setItem(k, v); localStorage.setItem(a, "1"); localStorage.setItem(b, "1"); } catch {} },
    [`sb-${ref}-auth-token`, JSON.stringify(sess.session), `zyvo_workspace_welcome:${TEST_USER}`, `zyvo_creator_rewards_seen:${TEST_USER}`]);
  await ctx.route("**/functions/v1/long-form-edit", async (route) => {
    const body = JSON.parse(route.request().postData() ?? "{}");
    if (body.action === "get") return route.fulfill({ json: served });
    return route.fulfill({ json: { ok: true, version: served.version + 1 } }); // read-only: nothing is written
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
  await page.goto(`http://localhost:5173/long-form/project/${TEST_PROJECT}/edit`, { waitUntil: "domcontentloaded" });
  await page.getByTestId("edit-preview").waitFor({ timeout: 60000 });
  await page.waitForFunction(() => document.querySelector("audio")?.readyState >= 1, null, { timeout: 60000 });
  await page.evaluate((x) => { document.querySelector("audio").currentTime = Number(x); }, SEC);
  await page.waitForFunction(() => { const i = document.querySelector("[data-testid=edit-preview] img"); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 30000 }).catch(() => {});
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1800);
  return { ctx, page, errors };
}
const out = [];
for (const [w, h] of [[360, 740], [390, 844], [414, 896], [768, 1024]]) {
  const { ctx, page, errors } = await open({ width: w, height: h }, true);
  const m = await page.evaluate(() => {
    const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), w: Math.round(b.width), h: Math.round(b.height) }; };
    const nav = [...document.querySelectorAll("nav, [class*='fixed']")].map((e) => e.getBoundingClientRect()).filter((b) => b.bottom >= innerHeight - 2 && b.height >= 50 && b.height < 120 && b.width >= innerWidth - 2).sort((a, b) => a.top - b.top)[0];
    const small = [...document.querySelectorAll("[data-testid=mobile-toolbar] button, [data-testid=mobile-editor] > div:first-child button")].map((b) => b.getBoundingClientRect()).filter((b) => b.width < 44 || b.height < 44).length;
    return { mobileEditor: !!document.querySelector("[data-testid=mobile-editor]"), promo: /Free Zyvo Credits/.test(document.body.innerText), hScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth || document.getElementById("workspace-scroll")?.scrollWidth > document.getElementById("workspace-scroll")?.clientWidth,
      preview: r("[data-testid=edit-preview]"), timeline: r("[data-testid=mobile-timeline]"), toolbar: r("[data-testid=mobile-toolbar]"), navTop: nav ? Math.round(nav.top) : null, smallTargets: small, footer: !!document.querySelector("[data-long-form-footer]") };
  });
  await page.screenshot({ path: `${OUT}/mobile-${w}-1-default.png` });
  if (m.mobileEditor) {
    await page.getByTestId("tool-text").tap();
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${OUT}/mobile-${w}-2-text-sheet.png` });
    await page.getByRole("button", { name: "Close" }).last().tap();
    await page.waitForTimeout(500);
    const box = await page.getByTestId("mobile-timeline").boundingBox();
    await page.touchscreen.tap(box.x + box.width / 2 + 3, box.y + 30); // the scene under the playhead
    await page.waitForTimeout(600);
    m.contextToolbar = await page.getByTestId("ctx-split").isVisible().catch(() => false);
    await page.screenshot({ path: `${OUT}/mobile-${w}-3-scene-selected.png` });
  }
  out.push({ size: `${w}x${h}`, ...m, errors });
  await ctx.close();
}
// Desktop: Auto mix, then a cut selected.
{
  const { ctx, page, errors } = await open({ width: 1920, height: 1080 }, false);
  await page.getByTestId("transition-auto-mix").click();
  await page.waitForTimeout(600);
  const kinds = await page.locator("[data-testid=cut-marker]").evaluateAll((els) => els.map((e) => e.getAttribute("data-kind")));
  await page.locator("[data-testid=cut-marker]").nth(3).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/desktop-cut-transition.png` });
  out.push({ size: "1920x1080", visibleMarkers: kinds.length, nonCutVisible: kinds.filter((k) => k !== "cut").length, pickerOpen: await page.getByTestId("props-cut").isVisible(), errors });
  await ctx.close();
}
console.log(JSON.stringify(out, null, 1));
await browser.close();
