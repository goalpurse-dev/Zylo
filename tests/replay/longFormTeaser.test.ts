// The free Long Form teaser (2026-10-04): a title, a one-line hook and 3 V2
// scenes for free accounts, never more than $0.02 of provider cost. No
// research, no fact-check, no script, no upscale, no AI check. These tests run
// the real teaser logic with stub providers ($0).
import { assert, assertEquals, assertMatch } from "jsr:@std/assert@1";
import {
  runTeaser, teaserBudget, teaserGate, teaserPrompt, teaserSceneTask, writeTeaserPlan, normalizePlan, canSpend, tokenUsd, hookIssues,
  HOOK_BANNED_PHRASES, SCRIPT_SLOP_PHRASES, TEASER_HOOK_FIXES, HOOK_FIX_MAX_USD, TEASER_CAP_USD, TEASER_MODEL, TEASER_SCENES, TEASER_SCENE_EST_USD, TEASER_DAILY_LIMIT, TEASER_IP_DAILY_LIMIT, TEASER_MAX_OUTPUT_TOKENS,
} from "../../supabase/functions/_shared/stickman/teaser.ts";
import { STICKMAN_RENDER_TIERS } from "../../supabase/functions/_shared/stickman/renderTiers.ts";
import { BANNED_LECTURE_PHRASES } from "../../supabase/functions/_shared/stickman/scriptChecks.ts";
import { teaserSteps, teaserBusy, fullVideoFacts, armTeaserAutostart, disarmTeaserAutostart, takeTeaserAutostart, shouldAutostartTeaser, TEASER_AUTOSTART_KEY } from "../../src/pages/workspace/long-form/teaserView.js";

const read = (p: string) => Deno.readTextFileSync(new URL(`../../${p}`, import.meta.url));
const input = { topic: "How did Rome feed an army on the march?", nicheId: "military_logistics_history", nicheLabel: "Military Logistics" };
const plan = { title: "What Fueled the Roman Army on the March?", hook: "You tighten the strap of a grain sack that has rubbed your shoulder raw since dawn.", scenes: ["A Roman legionary in a red tunic studies a scroll in a camp.", "A grain merchant in a tunic weighs sacks beside two legionaries.", "Four Roman legionaries in armor march down a dusty road."] };
const io = (over: any = {}) => {
  const costs: any[] = [], drawn: number[] = [];
  return {
    costs, drawn,
    writePlan: async () => ({ plan, usd: 0.000143, inputTokens: 428, outputTokens: 131, model: TEASER_MODEL }),
    drawScene: async (_d: string, i: number) => { drawn.push(i); return { imageUrl: `https://x/${i + 1}.jpg`, usd: 0.00247, costKnown: true }; },
    cost: (c: any) => { costs.push(c); },
    ...over,
  };
};

Deno.test("the cost is worked out before anything is called, and it fits the $0.02 cap with room", () => {
  assertEquals(TEASER_CAP_USD, 0.02);
  const b = teaserBudget(input);
  assert(b.fits, JSON.stringify(b));
  assertEquals(b.scenes, 3);
  // Worst case: the plan call at its output limit + 3 pictures. Under half the cap.
  assert(b.estimate < 0.01, String(b.estimate));
  assertEquals(b.estimate, Number((b.planMax + 3 * TEASER_SCENE_EST_USD).toFixed(6)));
  // The writing step's worst case includes both hook rewrites it may make.
  assert(b.planMax >= TEASER_HOOK_FIXES * HOOK_FIX_MAX_USD);
  // The plan call is capped: even a full 400-token answer on a long prompt costs a fraction of a cent.
  assert(tokenUsd(2000, TEASER_MAX_OUTPUT_TOKENS) < 0.001);
  // A cap the estimate cannot fit is refused before the start.
  assertEquals(teaserBudget(input, 0.005).fits, false);
});

Deno.test("a normal teaser: one plan call, 3 pictures, the measured cost, every cost reported", async () => {
  const x = io();
  const r: any = await runTeaser(input, x);
  assert(r.ok);
  assertEquals(x.drawn, [0, 1, 2]);
  assertEquals(r.scenes.map((s: any) => s.status), ["ready", "ready", "ready"]);
  assertEquals(r.spentUsd, 0.007553); // the run measured on 2026-10-04
  assert(r.underCap);
  assertEquals(x.costs.map((c: any) => c.step), ["plan", "scene", "scene", "scene"]);
  assertEquals(Number(x.costs.reduce((a: number, c: any) => a + c.usd, 0).toFixed(6)), r.spentUsd);
});

Deno.test("during the run: a picture that would pass the cap is not drawn", async () => {
  // Pictures suddenly cost 3x: after two of them the third no longer fits.
  const x = io({ drawScene: async (_d: string, i: number) => { x.drawn.push(i); return { imageUrl: `https://x/${i}.jpg`, usd: 0.0085, costKnown: true }; } });
  const r: any = await runTeaser(input, x);
  assertEquals(x.drawn, [0, 1]);
  assertEquals(r.scenes.map((s: any) => s.status), ["ready", "ready", "skipped"]);
  assert(r.spentUsd <= TEASER_CAP_USD, String(r.spentUsd));
  assert(r.ok, "the two drawn pictures are still shown");
  assert(canSpend(0.0174, TEASER_SCENE_EST_USD));
  assert(!canSpend(0.0175, TEASER_SCENE_EST_USD));
});

Deno.test("a failed draw is charged its estimate against the cap; nothing drawn = failed teaser", async () => {
  const x = io({ drawScene: async () => { throw new Error("runware 500"); } });
  const r: any = await runTeaser(input, x);
  assertEquals(r.ok, false);
  assertEquals(r.scenes.map((s: any) => s.status), ["failed", "failed", "failed"]);
  assertEquals(r.spentUsd, Number((0.000143 + 3 * TEASER_SCENE_EST_USD).toFixed(6)));
});

Deno.test("the plan is ONE call to the cheapest model, and it is told nothing was researched", async () => {
  assertEquals(TEASER_MODEL, "gpt-4o-mini");
  const calls: any[] = [];
  const post: any = async (url: string, init: any) => {
    calls.push({ url, body: JSON.parse(init.body) });
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ ...plan, scenes: [...plan.scenes, "A fourth scene that must be dropped from the list."] }) } }], usage: { prompt_tokens: 428, completion_tokens: 131 } }), { status: 200 });
  };
  const w = await writeTeaserPlan("k", input, post);
  assertEquals(calls.length, 1);
  assertEquals(calls[0].body.model, "gpt-4o-mini");
  assertEquals(calls[0].body.max_tokens, TEASER_MAX_OUTPUT_TOKENS);
  assertEquals(w.plan.scenes.length, TEASER_SCENES, "never more than 3 scenes");
  assertEquals(w.usd, 0.000143);
  const p = teaserPrompt(input);
  assertMatch(p, /Nothing has been researched, so never state a fact, number, date or name as true/);
  assertMatch(p, /EXACTLY 3 pictures/);
  // A missing title falls back to the idea; junk scenes are dropped.
  assertEquals(normalizePlan({ scenes: ["x", "A stickman farmer in a straw hat waters a field."] }, input).scenes.length, 1);
  assertEquals(normalizePlan({}, input).title, input.topic);
});

// A fetch stub that answers the plan call, then each hook rewrite in turn.
const openai = (planHook: string, fixes: (string | null)[]) => {
  const calls: any[] = [];
  const post: any = async (_url: string, init: any) => {
    const body = JSON.parse(init.body);
    calls.push(body);
    const name = body.response_format.json_schema.name;
    if (name === "teaser") return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ ...plan, hook: planHook }) } }], usage: { prompt_tokens: 600, completion_tokens: 130 } }), { status: 200 });
    const next = fixes.shift();
    if (next == null) return new Response("{}", { status: 500 });
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ hook: next }) } }], usage: { prompt_tokens: 400, completion_tokens: 30 } }), { status: 200 });
  };
  return { calls, post };
};
const GOOD_HOOK = "Your stomach growls as the grain sack on your shoulder gets lighter with every mile of dust.";

Deno.test("hook rules: the script's cold-open rules and its banned phrases, checked in code", () => {
  // Hooks the first version really produced: none of them is a cold open.
  for (const bad of [
    "Picture the vast Roman legions marching tirelessly, but how did they eat on the go?",
    "Ever wondered how Rome managed to keep its massive army well-fed during long campaigns?",
    "How did the mighty Roman legions keep their strength without faltering on the march?",
    "Imagine a world where an army had to carry every meal on its back.",
    "You are about to see something. In this video, you learn how Rome fed its army.",
    "Welcome back, today your army marches on its stomach.",
    "Did you know your legion carried its own grain?",
    "",
  ]) assert(hookIssues(bad).length > 0, bad);
  assertEquals(hookIssues(GOOD_HOOK), []);
  assertEquals(hookIssues(plan.hook), []);
  // The same lists as the main script check, nothing dropped.
  for (const p of BANNED_LECTURE_PHRASES) assert(HOOK_BANNED_PHRASES.includes(p), p);
  const script = read("supabase/functions/advance-long-form-script/index.ts");
  const slop = script.slice(script.indexOf("const SLOP_PHRASES = ["), script.indexOf("];", script.indexOf("const SLOP_PHRASES = [")));
  assertEquals([...slop.matchAll(/"([^"]+)"/g)].map((m) => m[1]), SCRIPT_SLOP_PHRASES, "SCRIPT_SLOP_PHRASES must stay identical to the script check's SLOP_PHRASES");
  for (const phrase of HOOK_BANNED_PHRASES) assert(hookIssues(`You stand in the mud and ${phrase} the rain keeps falling on your pack.`).length > 0, phrase);
  // The model is told the rules too.
  const p = teaserPrompt(input);
  assertMatch(p, /COLD OPEN/);
  assertMatch(p, /second person/);
  assertMatch(p, /Never start with Imagine, Picture/);
  for (const phrase of HOOK_BANNED_PHRASES) assert(p.includes(`"${phrase}"`), phrase);
});

Deno.test("a lecture hook is rewritten (at most twice) and left out if it still breaks the rules", async () => {
  // Rewritten once: two calls, both paid for.
  const once = openai("Imagine a world where an army carried every meal.", [GOOD_HOOK]);
  const a = await writeTeaserPlan("k", input, once.post);
  assertEquals([a.plan.hook, a.calls, a.hookFixes, a.hookDropped], [GOOD_HOOK, 2, 1, false]);
  assertEquals(once.calls.map((c: any) => c.response_format.json_schema.name), ["teaser", "teaser_hook"]);
  assertEquals(once.calls[1].model, TEASER_MODEL);
  assertMatch(once.calls[1].messages[0].content, /a sentence starts with "Imagine"/);
  assertEquals(a.usd, tokenUsd(1000, 160));
  // Still a lecture after two rewrites: no hook is shown, the teaser goes on.
  const never = openai("Picture the legions marching.", ["Ever wondered how they ate?", "What if you had no bread?"]);
  const b = await writeTeaserPlan("k", input, never.post);
  assertEquals([b.plan.hook, b.calls, b.hookFixes, b.hookDropped], ["", 1 + TEASER_HOOK_FIXES, TEASER_HOOK_FIXES, true]);
  assertEquals(never.calls.length, 3, "never more than two rewrites");
  assertEquals(b.plan.scenes.length, 3);
  // A rewrite call that fails never fails the teaser.
  const broken = openai("Picture the legions marching.", [null]);
  const c = await writeTeaserPlan("k", input, broken.post);
  assertEquals([c.plan.hook, c.hookDropped, c.plan.title], ["", true, plan.title]);
  // Worst case (plan + both rewrites + 3 pictures) is far inside the cap.
  assert(teaserBudget(input).estimate <= TEASER_CAP_USD / 2, String(teaserBudget(input).estimate));
});

Deno.test("auto-start: only straight after a sign-up in the Generate box, once, in that tab", () => {
  const store = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); }, removeItem: (k: string) => { m.delete(k); }, size: () => m.size }; };
  const now = Date.parse("2026-10-04T18:00:00Z");
  const fresh = new Date(now - 60_000).toISOString(), old = new Date(now - 9 * 30 * 86_400_000).toISOString();
  const s = store();
  // Nothing armed (a plain page load, a reload, the Back button, a new tab): never.
  assertEquals(takeTeaserAutostart(s, now), false);
  // Armed by the sign-up, read once, gone at once.
  armTeaserAutostart(s, now - 5_000);
  assertEquals(s.getItem(TEASER_AUTOSTART_KEY), String(now - 5_000));
  assertEquals(takeTeaserAutostart(s, now), true);
  assertEquals(s.size(), 0, "cleared the moment it is read");
  assertEquals(takeTeaserAutostart(s, now), false, "a reload finds nothing");
  // Closing the box without signing up disarms it; an old flag is ignored (and still removed).
  armTeaserAutostart(s, now); disarmTeaserAutostart(s);
  assertEquals(takeTeaserAutostart(s, now), false);
  armTeaserAutostart(s, now - 11 * 60_000);
  assertEquals(takeTeaserAutostart(s, now), false);
  assertEquals(s.size(), 0);
  // Broken storage never starts anything.
  assertEquals(takeTeaserAutostart({ getItem: () => { throw new Error("blocked"); }, removeItem: () => {} } as any, now), false);
  // The rule: armed + signed in + free + a brand-new account + the setup filled in.
  const yes = { armed: true, signedIn: true, isPaid: false, accountCreatedAt: fresh, setupFilled: true, now };
  assertEquals(shouldAutostartTeaser(yes), true);
  assertEquals(shouldAutostartTeaser({ ...yes, armed: false }), false);
  assertEquals(shouldAutostartTeaser({ ...yes, signedIn: false }), false);
  assertEquals(shouldAutostartTeaser({ ...yes, isPaid: true }), false, "a paid plan never gets the teaser");
  assertEquals(shouldAutostartTeaser({ ...yes, setupFilled: false }), false);
  assertEquals(shouldAutostartTeaser({ ...yes, accountCreatedAt: old }), false, "an existing account signing in through the box starts nothing");
  assertEquals(shouldAutostartTeaser({ ...yes, accountCreatedAt: null }), false);
});

Deno.test("the pictures are V2: no upscale, one image, the stickman style, no text", () => {
  const task: any = teaserSceneTask(plan.scenes[0]);
  assertEquals(task.model, STICKMAN_RENDER_TIERS.V2.model);
  assertEquals(task.numberResults, 1);
  assertEquals([task.width, task.height], [1376, 768]);
  assertEquals(task.taskType, "imageInference");
  assert(!JSON.stringify(task).toLowerCase().includes("upscale"));
  assertMatch(task.positivePrompt, /Scene: A Roman legionary/);
});

Deno.test("who may start one: free accounts only, verified email, 3 a day, an IP limit", () => {
  const ok = { plan: "free", emailVerified: true, userToday: 0, ipToday: 0, drawingPaused: false };
  assertEquals(teaserGate(ok), { ok: true });
  for (const plan of ["starter", "pro", "generative"]) assertEquals((teaserGate({ ...ok, plan }) as any).code, "PAID_USER");
  assertEquals((teaserGate({ ...ok, emailVerified: false }) as any).code, "EMAIL_NOT_VERIFIED");
  assertEquals(TEASER_DAILY_LIMIT, 3);
  assertEquals(teaserGate({ ...ok, userToday: 2 }), { ok: true });
  assertEquals((teaserGate({ ...ok, userToday: 3 }) as any).code, "DAILY_LIMIT");
  assertEquals((teaserGate({ ...ok, ipToday: TEASER_IP_DAILY_LIMIT }) as any).code, "IP_LIMIT");
  assertEquals((teaserGate({ ...ok, drawingPaused: true }) as any).code, "DRAWING_PAUSED");
});

Deno.test("the function: gate before any spend, every cost in the ledger, no research or script step", () => {
  const fn = read("supabase/functions/long-form-teaser/index.ts");
  assert(fn.indexOf("teaserGate(") < fn.indexOf("EdgeRuntime.waitUntil(work(row))"), "the checks come before the work starts");
  assert(fn.indexOf("teaserBudget(") < fn.indexOf(".insert({ user_id: user.id"), "the cost is worked out before the row exists");
  assertMatch(fn, /recordCost\(admin, \{[\s\S]{0,400}purpose: "teaser"[\s\S]{0,200}sourceTable: "long_form_teasers", sourceId: id/);
  assertMatch(fn, /email_confirmed_at/);
  assertMatch(fn, /ip_hash/);
  const code = fn.split(/\r?\n/).filter((l) => !l.trim().startsWith("//")).join(" ").toLowerCase();
  for (const banned of ["researchengine", "scriptengine", "factcheck", "upscale(", "sceneqa", "elevenlabs"]) assert(!code.includes(banned), banned);
  // "paid" is only stamped for an account that really has a plan.
  assertMatch(fn, /if \(event === "paid"\) \{[\s\S]{0,260}=== "free"\) return ok\(req, \{ ok: true, ignored: true \}\)/);
  const sql = read("supabase/migrations/20261025100000_long_form_teasers.sql");
  assertMatch(sql, /enable row level security/);
  assertMatch(sql, /for select to authenticated using \(user_id = auth\.uid\(\)\)/);
  assert(!/for (insert|update|delete|all)/i.test(sql), "users never write teaser rows");
  for (const col of ["cost_usd", "upgrade_clicked_at", "paid_at", "full_started_at", "finished_at"]) assert(sql.includes(col), col);
});

Deno.test("the loading screen shows the real steps, from the teaser's own state", () => {
  assertEquals(teaserSteps(null).map((s: any) => [s.label, s.state]), [["Writing your title…", "active"], ["Drawing scene 1 of 3", "waiting"], ["Drawing scene 2 of 3", "waiting"], ["Drawing scene 3 of 3", "waiting"]]);
  const drawing = { status: "drawing", sceneCount: 3, scenes: [{ n: 1, status: "ready", imageUrl: "a" }, { n: 2, status: "drawing" }, { n: 3, status: "queued" }] };
  assertEquals(teaserSteps(drawing).map((s: any) => [s.label, s.state]), [["Title and hook written", "done"], ["Scene 1 drawn", "done"], ["Drawing scene 2 of 3…", "active"], ["Drawing scene 3 of 3", "waiting"]]);
  assert(teaserBusy(drawing) && teaserBusy(null) && !teaserBusy({ status: "done" }) && !teaserBusy({ status: "failed" }));
  // The upgrade card's numbers come from the length picked on the Create page.
  assertEquals(fullVideoFacts({ setup: { lengthMinutes: 10 } }), { minutes: 10, scenes: 150 });
  assertEquals(fullVideoFacts({ setup: {} }), { minutes: 10, scenes: 150 });
  assertEquals(fullVideoFacts({ setup: { lengthMinutes: 15 } }).minutes, 15);
});
