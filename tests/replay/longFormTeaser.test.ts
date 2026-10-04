// The free Long Form teaser (2026-10-04): a title, a one-line hook and 3 V2
// scenes for free accounts, never more than $0.02 of provider cost. No
// research, no fact-check, no script, no upscale, no AI check. These tests run
// the real teaser logic with stub providers ($0).
import { assert, assertEquals, assertMatch } from "jsr:@std/assert@1";
import {
  runTeaser, teaserBudget, teaserGate, teaserPrompt, teaserSceneTask, writeTeaserPlan, normalizePlan, canSpend, tokenUsd,
  TEASER_CAP_USD, TEASER_MODEL, TEASER_SCENES, TEASER_SCENE_EST_USD, TEASER_DAILY_LIMIT, TEASER_IP_DAILY_LIMIT, TEASER_MAX_OUTPUT_TOKENS,
} from "../../supabase/functions/_shared/stickman/teaser.ts";
import { STICKMAN_RENDER_TIERS } from "../../supabase/functions/_shared/stickman/renderTiers.ts";
import { teaserSteps, teaserBusy, fullVideoFacts } from "../../src/pages/workspace/long-form/teaserView.js";

const read = (p: string) => Deno.readTextFileSync(new URL(`../../${p}`, import.meta.url));
const input = { topic: "How did Rome feed an army on the march?", nicheId: "military_logistics_history", nicheLabel: "Military Logistics" };
const plan = { title: "What Fueled the Roman Army on the March?", hook: "How did the legions keep marching?", scenes: ["A Roman legionary in a red tunic studies a scroll in a camp.", "A grain merchant in a tunic weighs sacks beside two legionaries.", "Four Roman legionaries in armor march down a dusty road."] };
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
