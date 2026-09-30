// AI Fruit Story v2 out-of-credit guard: when OUR provider account can't pay,
// refund at once (no retries, no fallback), alert the admin, friendly message.
import test from "node:test";
import assert from "node:assert/strict";
import { createEngine } from "../supabase/functions/_shared/fruit/engine.js";
import { parseRunware } from "../supabase/functions/_shared/fruit/runware.js";
import { llmOutOfBalance } from "../supabase/functions/_shared/fruit/alerts.js";
import { MESSAGES } from "../supabase/functions/_shared/fruit/errors.js";
import { createMemoryDb } from "./helpers/fruitMemoryStore.mjs";

const ERR = (taskUUID, code, message) => ({ errors: [{ code, message, taskUUID }] });

test("Runware balance refusals are classified as provider balance, not retryable", () => {
  for (const [code, msg, http] of [
    ["insufficientCredits", "Insufficient credits to process the request", 400],
    ["concurrentRequestLimitExceeded", "Request refused: available balance is too low for this request", 400],
    ["error", "", 402],
  ]) {
    const p = parseRunware(ERR("t1", code, msg), "t1", http);
    assert.equal(p.providerBalance, true, `${code} ${msg}`);
    assert.equal(p.retryable, false);
  }
  const busy = parseRunware(ERR("t1", "timeout", "Provider timed out"), "t1", 504);
  assert.ok(busy.retryable && !busy.providerBalance);
});

test("LLM out-of-credit errors are spotted (Anthropic 400 credit balance, OpenAI 429 insufficient_quota)", () => {
  assert.equal(llmOutOfBalance({ httpStatus: 400, response: { error: { type: "invalid_request_error", message: "Your credit balance is too low to access the Anthropic API." } } }), true);
  assert.equal(llmOutOfBalance({ httpStatus: 429, response: { error: { code: "insufficient_quota", message: "You exceeded your current quota" } } }), true);
  assert.equal(llmOutOfBalance({ httpStatus: 529, response: { error: { type: "overloaded_error" } } }), false);
});

test("a clip refused for balance is refunded at once, no retry, no fallback, admin alerted once", async () => {
  const db = createMemoryDb();
  const sent = [];
  const alerts = [];
  const eng = createEngine({
    store: db.store, media: { store: async ({ path }) => path }, env: {}, now: () => db.clock(), log: { error() {} },
    uuid: (() => { let i = 0; return () => `00000000-0000-4000-8000-${String(++i).padStart(12, "0")}`; })(),
    runware: { submit: async (env) => { sent.push(env); return { httpStatus: 400, body: ERR(env.taskUUID, "insufficientCredits", "Insufficient credits") }; }, poll: async () => ({ httpStatus: 200, body: { data: [] } }) },
    fallbackClip: (req) => (req.model === "wan" ? { ...req, model: "seedance" } : null),
    onProviderBalance: async (a) => { alerts.push(a); },
  });
  const storyId = db.addStory({ sceneCount: 1, status: "pictures_ready" });
  const [scene] = [...db.scenes.values()];
  db.chargeStep(storyId, { from: ["pictures_ready"], to: "animating", items: [{ scene_id: scene.id, kind: "clip", credits: 25, request: { taskType: "videoInference", model: "wan", positivePrompt: "p" } }] });
  assert.equal(db.balance, 975);
  await eng.kick({ storyId });
  await eng.kick({ storyId });
  const job = [...db.jobs.values()][0];
  assert.deepEqual(sent.map((e) => e.model), ["wan"], "sent once: no retry, no Seedance fallback on the same account");
  assert.equal(job.status, "failed");
  assert.equal(job.error_code, "PROVIDER_UNAVAILABLE");
  assert.equal(db.balance, 1000, "refunded in full");
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].code, "insufficientCredits");
  assert.match(MESSAGES.PROVIDER_UNAVAILABLE, /short break.*weren't charged/);
});
