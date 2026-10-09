// Checks on the LIVE website, for the launch of Blocky Stories and after it. It makes a throwaway account on
// the free plan (deleted at the end), signs it in through the site's own sign-in form, and looks at the
// site the way three kinds of people do: signed out, that free account, and the owner.
//   --pre   before Blocky is switched on for everyone: the site loads, sign-in works, the owner's pages
//           (Fruit, Long Form, Blocky, /admin/ops) open, a normal account can't open /admin/ops, and nothing
//           of Blocky is on the home page.
//   (none)  after launch: all of the above, and Blocky itself: on Home (the card and the section), the
//           signed-out view with sign-up on every button, the free account's ideas (ONE real batch per
//           width, about 1 cent each) and the upgrade popup on anything further.
// Everything at 1440 and 390 px. It never presses a button that makes pictures or video.
//   node scripts/blocky/qaLive.mjs <outDir> [--pre] [baseUrl]
import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { ROOT, SUPABASE_URL, admin, anonKey, api, userSession } from "./lib.mjs";

const require = createRequire(path.join(ROOT, "package.json"));
const { chromium } = require("playwright");
const args = process.argv.slice(2);
const pre = args.includes("--pre");
const [outDir, base = "https://www.tryzyvo.com"] = args.filter((a) => a !== "--pre");
fs.mkdirSync(outDir, { recursive: true });
const BLOCKY = "/workspace/blocky-stories";
const ref = new URL(SUPABASE_URL).hostname.split(".")[0];
const db = admin();
const results = [];
const ok = (name, pass, detail = "") => { results.push(Boolean(pass)); console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`); };

const live = (await db.from("global_feature_flags").select("enabled").eq("key", "blocky_v1").maybeSingle()).data?.enabled === true;
ok(pre ? "before launch: Blocky's global switch is off" : "Blocky's global switch is on", pre ? !live : live);
const owner = await userSession();
const { data: { session: ownerSession } } = await owner.client.auth.getSession();

// The throwaway account: a normal sign-up on the free plan, with a password of its own.
const email = "upwardlift6+blockylivetest@gmail.com";
const password = `${crypto.randomUUID()}Aa1!`;
const made = await db.auth.admin.createUser({ email, password, email_confirm: true });
if (made.error) { console.error(`Couldn't make the throwaway account: ${made.error.message}`); process.exit(1); }
const userId = made.data.user.id;
const browser = await chromium.launch({ channel: "chrome" }).catch(() => chromium.launch());

/** The cookie note and the Long Form welcome popup greet a new visitor: both are closed first. */
async function clear(p) {
  await p.getByRole("button", { name: "Decline" }).click({ timeout: 3000 }).catch(() => {});
  await p.getByRole("dialog").getByRole("button", { name: "Close" }).click({ timeout: 5000 }).catch(() => {});
  // A brand-new account gets the site's "You're in." welcome screen over the page once.
  await p.getByRole("button", { name: "Explore on my own" }).click({ timeout: 2500 }).catch(() => {});
  await p.waitForTimeout(400);
}
async function context(viewport, session = null) {
  const phone = viewport.width < 500;
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: phone ? 2 : 1, isMobile: phone, hasTouch: phone });
  await ctx.addInitScript(([key, value]) => { localStorage.setItem("zyvo_cookie_consent", "declined"); if (value) localStorage.setItem(key, value); }, [`sb-${ref}-auth-token`, session ? JSON.stringify(session) : null]);
  const p = await ctx.newPage();
  const errors = [];
  const calls = [];
  p.on("pageerror", (e) => errors.push(e.message.slice(0, 160)));
  p.on("request", (r) => { if (r.url().includes("/functions/v1/blocky-story-api") && r.method() === "POST") calls.push(r.postDataJSON?.()?.action ?? "?"); });
  const go = async (to) => { await p.goto(`${base}${to}`, { waitUntil: "domcontentloaded", timeout: 120_000 }); await p.waitForTimeout(3000); await clear(p); };
  const shot = async (name) => { await p.waitForTimeout(600); await p.screenshot({ path: path.join(outDir, `${name}.png`) }); };
  return { p, ctx, phone, errors, calls, go, shot };
}
const SHOWCASE = 'section[aria-label="Videos made with Blocky Stories"]';
const SIGNUP = "Free to join. Your Blocky story is a few minutes away.";
const UPGRADE = "Upgrade your plan to continue";
const homeHas = async (p) => ({
  card: await p.locator(`a[href="${BLOCKY}"]:has(img[alt="Blocky Stories"]) >> visible=true`).count(),
  section: await p.locator('[data-testid="featured-blocky"]').count(),
  cartoon: await p.locator('[data-testid="featured-template"]').count(),
});

try {
  for (const [w, viewport] of [["1440", { width: 1440, height: 900 }], ["390", { width: 390, height: 844 }]]) {
    // ── Signed out ──
    {
      const v = await context(viewport);
      const { p } = v;
      await v.go("/");
      const title = await p.title();
      ok(`${w}, signed out: the home page loads`, /Zyvo/i.test(title) && (await p.locator('[data-testid="featured-template"]').count()) === 1, title.slice(0, 60));
      const h = await homeHas(p);
      if (pre) ok(`${w}, signed out, before launch: nothing of Blocky on Home`, h.card === 0 && h.section === 0);
      else {
        await p.locator(`a[href="${BLOCKY}"]:has(img[alt="Blocky Stories"]) >> visible=true`).first().scrollIntoViewIfNeeded();
        await v.shot(`live-home-card-${w}`);
        const section = p.locator('[data-testid="featured-blocky"]');
        await section.scrollIntoViewIfNeeded();
        await p.evaluate(() => { const s = document.querySelector('[data-testid="featured-blocky"]'); (document.getElementById("workspace-scroll") ?? document.scrollingElement).scrollBy(0, s.getBoundingClientRect().top - 70); });
        await p.waitForTimeout(3500);
        const s = await p.evaluate(() => { const b = document.querySelector('[data-testid="featured-blocky"]'), c = document.querySelector('[data-testid="featured-template"]'); const vs = [...b.querySelectorAll("video")]; return { above: b.nextElementSibling === c, title: b.querySelector("h2").textContent.trim(), tiles: b.querySelectorAll('a[aria-label^="Try the"]').length, videos: vs.length, playing: vs.filter((x) => !x.paused && x.readyState >= 2).length, muted: vs.every((x) => x.muted && x.loop), posters: [...b.querySelectorAll("img")].filter((i) => i.complete && i.naturalWidth > 0).length }; });
        await v.shot(`live-home-section-${w}`);
        ok(`${w}, signed out: Home has the Blocky card and the Blocky section above Cartoon Drive By, clips playing`, h.card >= 1 && h.section === 1 && s.above && s.title === "Blocky Stories" && s.tiles === 4 && s.posters >= 4 && s.videos >= 2 && s.muted && s.playing === s.videos, JSON.stringify(s));
        await section.getByRole("link", { name: /Try Template/ }).click();
        await p.waitForURL((u) => u.pathname === BLOCKY, { timeout: 30_000 }).catch(() => {});
        await p.getByRole("heading", { name: "Sign up to create your own" }).waitFor({ timeout: 30_000 }).catch(() => {});
        await p.waitForTimeout(2500);
        const view = { path: new URL(p.url()).pathname, message: await p.getByRole("heading", { name: "Sign up to create your own" }).count(), videos: await p.locator(`${SHOWCASE} video`).count(), playing: await p.locator(`${SHOWCASE} video`).evaluateAll((vs) => vs.filter((x) => !x.paused && x.readyState >= 2).length) };
        await v.shot(`live-guest-view-${w}`);
        ok(`${w}, signed out: Try Template lands on the Blocky page with the showcase and "Sign up to create your own"`, view.path === BLOCKY && view.message === 1 && view.videos === 2, JSON.stringify(view));
        // The buttons that make or continue something open the sign-up popup.
        await p.locator(SHOWCASE).getByRole("button", { name: "Sign up", exact: true }).click();
        const fromVideos = await p.getByText(SIGNUP).count();
        await p.mouse.click(5, 5); await p.waitForTimeout(400);
        if (v.phone) { await p.getByRole("button", { name: "Look around first" }).click(); await p.waitForTimeout(500); }
        await p.getByRole("button", { name: "Give me ideas" }).click();
        const fromIdeas = await p.getByText(SIGNUP).count();
        await v.shot(`live-guest-signup-${w}`);
        await p.mouse.click(5, 5); await p.waitForTimeout(400);
        await p.locator('[aria-label="How do you want to start?"] button', { hasText: "Describe it" }).click();
        await p.getByRole("button", { name: /Add character/ }).first().click();
        const dialog = p.getByRole("dialog");
        await dialog.locator("button[aria-pressed]").first().waitFor({ timeout: 20_000 }).catch(() => {});
        const avatars = await dialog.locator("button[aria-pressed]").count();
        for (const who of ["Noob", "Vex"]) await dialog.locator("button[aria-pressed]", { hasText: who }).first().click().catch(() => {});
        await dialog.getByRole("button", { name: "Done" }).click();
        await p.locator("#fv2-prompt").fill("Noob trades a starter pet for Vex's rarest item, and the pet turns out to be the server's owner.");
        await p.waitForTimeout(600);
        await p.getByRole("button", { name: /Write 3 versions/ }).click();
        const fromWrite = await p.getByText(SIGNUP).count();
        ok(`${w}, signed out: the buttons open the sign-up popup (videos, ideas, write), and the avatar library opens`, fromVideos === 1 && fromIdeas === 1 && fromWrite === 1 && avatars === 52, `library ${avatars}`);
        ok(`${w}, signed out: nothing was asked of the server but the library`, [...new Set(v.calls)].join() === "listCharacters", [...new Set(v.calls)].join());
      }
      ok(`${w}, signed out: no page errors`, v.errors.length === 0, v.errors.join(" | "));
      await v.ctx.close();
    }
    // ── A normal account on the free plan, signed in through the site's own form ──
    {
      const v = await context(viewport);
      const { p } = v;
      await v.go("/");
      await p.getByRole("button", { name: "Login", exact: true }).first().click();
      await p.locator('input[type="email"]').fill(email);
      await p.locator('input[type="password"]').fill(password);
      await p.locator('button[type="submit"]').click();
      await p.waitForFunction((key) => Boolean(localStorage.getItem(key)), `sb-${ref}-auth-token`, { timeout: 30_000 }).catch(() => {});
      await p.waitForTimeout(2500);
      const signedIn = await p.evaluate((key) => { try { return JSON.parse(localStorage.getItem(key))?.user?.email ?? null; } catch { return null; } }, `sb-${ref}-auth-token`);
      ok(`${w}: sign-in works through the site's own form`, signedIn === email && (await p.getByRole("button", { name: "Login", exact: true }).count()) === 0, signedIn ? "signed in" : "not signed in");
      // The owner's page is not for a normal account.
      await v.go("/admin/ops");
      await p.locator('[data-testid="ops-denied"]').waitFor({ timeout: 30_000 }).catch(() => {});
      const denied = await p.locator('[data-testid="ops-denied"]').count();
      const anyNumbers = await p.locator('[data-testid="ops-blocky"], [data-testid="ops-provider"]').count();
      await v.shot(`live-ops-denied-${w}`);
      ok(`${w}, a normal account: /admin/ops shows "for the site owner" and no numbers`, denied === 1 && anyNumbers === 0);
      if (!pre) {
        await v.go(BLOCKY);
        if (v.phone) { await p.getByRole("tab", { name: "Examples" }).click(); await p.waitForTimeout(500); }
        const landing = { message: await p.getByRole("heading", { name: "Upgrade your plan to make videos like these" }).count(), seePlans: await p.locator(SHOWCASE).getByRole("button", { name: "See plans", exact: true }).count(), videos: await p.locator(`${SHOWCASE} video`).count() };
        await v.shot(`live-free-view-${w}`);
        ok(`${w}, the free account: the showcase with "Upgrade your plan to make videos like these" and "See plans"`, landing.message === 1 && landing.seePlans === 1 && landing.videos === 2, JSON.stringify(landing));
        if (v.phone) { await p.getByRole("tab", { name: "Build" }).click(); await p.waitForTimeout(500); }
        const pressable = 'section[aria-label="Story builder"] button[aria-pressed]';
        const before = await p.locator(pressable).count();
        await p.getByRole("button", { name: "Give me ideas" }).click();   // a real batch of ideas: about 1 cent of ours
        // The idea cards are the new buttons that can be picked; a real batch takes several seconds to write.
        await p.waitForFunction(([sel, n]) => document.querySelectorAll(sel).length >= n + 3, [pressable, before], { timeout: 120_000 }).catch(() => {});
        await p.waitForTimeout(800);
        const ideas = (await p.locator(pressable).count()) - before;
        await v.shot(`live-free-ideas-${w}`);
        ok(`${w}, the free account: "Give me ideas" gives ideas`, ideas >= 3 && v.calls.includes("getIdeas"), `${ideas} ideas`);
        await p.locator(pressable).nth(before).click();
        await p.waitForTimeout(700);
        await p.getByRole("button", { name: /Write 3 versions/ }).click();
        const popup = { title: await p.getByRole("heading", { name: UPGRADE }).count(), lines: await p.locator("[data-plan]").count(), href: await p.getByRole("link", { name: "See plans" }).getAttribute("href").catch(() => null) };
        await v.shot(`live-free-popup-${w}`);
        ok(`${w}, the free account: "Write 3 versions" opens the upgrade popup (three plans, "See plans")`, popup.title === 1 && popup.lines === 3 && popup.href === "/pricing" && !v.calls.includes("startDraft"), JSON.stringify(popup));
      }
      ok(`${w}, a normal account: no page errors`, v.errors.length === 0, v.errors.join(" | "));
      await v.ctx.close();
    }
    // ── The owner: the other tools still open ──
    {
      const v = await context(viewport, ownerSession);
      const { p } = v;
      await v.go("/workspace/ai-fruit-story");
      const fruit = await p.getByText(/Fruit Stor/i).first().count();
      await v.go("/long-form");
      const longForm = (await p.locator("#root").innerText()).length > 200 && new URL(p.url()).pathname.startsWith("/long-form");
      await v.go(BLOCKY);
      const blocky = await p.getByText("What's the story?").count();
      await v.go("/admin/ops");
      await p.locator('[data-testid="ops-blocky"]').waitFor({ timeout: 45_000 }).catch(() => {});
      await p.getByText("Spend ahead of charges").waitFor({ timeout: 30_000 }).catch(() => {});
      const card = (await p.locator('[data-testid="ops-blocky"]').innerText().catch(() => "")).replace(/\s+/g, " ");
      await p.locator('[data-testid="ops-blocky"]').scrollIntoViewIfNeeded().catch(() => {});
      await v.shot(`live-ops-owner-${w}`);
      ok(`${w}, the owner: Fruit, Long Form and Blocky open on the live site`, fruit >= 1 && longForm && blocky >= 1, `fruit ${fruit}, long form ${longForm}, blocky ${blocky}`);
      ok(`${w}, the owner: /admin/ops shows the Blocky card (limit ${pre ? "" : "and paid calls on"})`, /All users · last 3 hours \$[\d.,]+ of \$20\.00/i.test(card) && (pre || /Paid calls On/i.test(card)), card.slice(0, 150));
      ok(`${w}, the owner: no page errors`, v.errors.length === 0, v.errors.join(" | "));
      await v.ctx.close();
    }
  }
  // The same rules at the server, with the throwaway account's own sign-in.
  const other = await userSession(email);
  const ops = await api(other.accessToken, "opsStatus");
  ok("a normal account: the Blocky card's numbers are refused by the server", ops.code === "FORBIDDEN", `${ops.code}`);
  const cap = await api(other.accessToken, "opsSetWindowCap", { usd: 500 });
  ok("a normal account: it can't change the 3-hour limit", cap.code === "FORBIDDEN", `${cap.code}`);
  const shared = await fetch(`${SUPABASE_URL}/functions/v1/ops-status`, { method: "POST", headers: { Authorization: `Bearer ${other.accessToken}`, apikey: anonKey(), "Content-Type": "application/json" }, body: "{}" });
  ok("a normal account: the owner's page data is refused by the server", shared.status === 403 || shared.status === 401, `HTTP ${shared.status}`);
  if (!pre) {
    const library = await api(other.accessToken, "listCharacters");
    const draft = await api(other.accessToken, "startDraft", { input: { source: "prompt", prompt: "A new player trades a starter pet for the rarest item, and the pet turns out to own the server.", castIds: (library.data ?? []).slice(0, 2).map((c) => c.id), quality: "v2", lengthSec: 30, aspect: "9:16" } });
    ok("the free account: writing a story is refused by the server before anything is written or charged", draft.code === "PLAN_UPGRADE_REQUIRED" && draft.status === 403, `${draft.code}: ${draft.message}`);
    const spent = await db.from("blocky_ai_calls").select("purpose, cost_usd").eq("user_id", userId);
    const usd = (spent.data ?? []).reduce((s, r) => s + Number(r.cost_usd || 0), 0);
    const charged = await db.from("blocky_credit_ledger").select("id", { count: "exact", head: true }).eq("user_id", userId);
    ok("the free account cost us only its ideas, and was charged nothing", (spent.data ?? []).every((r) => /idea/i.test(r.purpose)) && usd < 0.1 && (charged.count ?? 0) === 0, `$${usd.toFixed(4)} in ${(spent.data ?? []).length} calls`);
  }
} finally {
  await browser.close();
  await db.auth.admin.deleteUser(userId);
  const gone = (await db.from("profiles").select("id").eq("id", userId)).data?.length === 0;
  ok("the throwaway account is deleted", gone);
}
console.log(`\n${results.filter(Boolean).length} of ${results.length} checks passed`);
process.exit(results.every(Boolean) ? 0 : 1);
