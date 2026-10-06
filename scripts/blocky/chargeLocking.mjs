// Two products, one credit balance, charged at the same moment. On the LOCAL
// stack only (a real Postgres with real connections; docs/blocky-local.md).
// It spends nothing: no provider is called, only the charge functions run.
//
//   1. The test account gets 40 credits: enough for exactly 10 pictures (4 each).
//   2. 30 charges are fired at once for that one account, each on its own
//      story: 15 through blocky_charge_step and 15 through fruit_charge_step.
//   3. Exactly 10 must succeed and 20 must be refused for lack of credits; the
//      balance must end at 0 (never below), and the two ledgers together must
//      show exactly 40 credits charged.
//   4. One charged Blocky job is refunded 10 times at once: 4 credits must come
//      back exactly once.
//
//   node scripts/blocky/chargeLocking.mjs
process.env.BLOCKY_TARGET = "local";
const { admin, TARGET, SUPABASE_URL, TEST_EMAIL } = await import("./lib.mjs");
if (TARGET !== "local" || !/^http:\/\/(127\.0\.0\.1|localhost):/.test(SUPABASE_URL)) { console.error("This runs on the local stack only."); process.exit(2); }

const db = admin();
const must = ({ data, error }, what) => { if (error) throw new Error(`${what}: ${error.message}`); return data; };
const user = (await db.auth.admin.listUsers()).data?.users?.find((u) => u.email === TEST_EMAIL);
if (!user) { console.error("No test account yet: run node scripts/blocky/local.mjs seed"); process.exit(2); }
const results = [];
const ok = (name, cond, detail = "") => { results.push(Boolean(cond)); console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`); };
const balance = async () => must(await db.from("profiles").select("credit_balance").eq("id", user.id).single(), "balance").credit_balance;
const before = await balance();

// A Fruit character and Fruit's picture price, in the local database only (it starts with no rows).
must(await db.from("tool_prices").upsert({ tool_key: "image:fruit-story", flat_credits: 4, allowed_sizes: ["768x1376", "1376x768"], min_plan: "starter", active: true, notes: "local test copy" }, { onConflict: "tool_key" }), "fruit price");
must(await db.from("fruit_characters").upsert({ id: "locktest", name: "Lock Test", fruit: "mango", gender: "female", age: 30, tag: "t", role: "r", voice_style: "v", face: "f", build: "b", outfit: "o", ref_image_url: "https://example.test/x.jpg", ref_image_path: "x", ref_width: 768, ref_height: 1376, ref_model: "m", ref_prompt: "p" }, { onConflict: "id" }), "fruit character");
const avatar = must(await db.from("blocky_characters").select("id").limit(1), "avatars")[0]?.id;
if (!avatar) { console.error("No avatar yet: run node scripts/blocky/local.mjs seed"); process.exit(2); }

const N = 15;
const story = (cast) => ({ source: "prompt", input: {}, title: "Lock test", cast_ids: [cast], quality: "v2", aspect: "9:16", length_sec: 5, locations: [], planner: {} });
const scene = (cast) => [{ title: "t", speaker_id: cast, line: "One line.", present_ids: [cast], location_id: "loc1", action: "a", emotion: "e", shot: "close-up", placement: "", duration_sec: 5 }];
const make = async (kind, cast) => {
  const id = must(await db.rpc(`${kind}_create_story`, { p_user_id: user.id, p_story: story(cast), p_scenes: scene(cast), p_call_ids: [] }), `${kind}_create_story`);
  const sceneId = must(await db.from(`${kind}_story_scenes`).select("id").eq("story_id", id).single(), "scene").id;
  return { kind, id, sceneId };
};
const stories = [...await Promise.all(Array.from({ length: N }, () => make("blocky", avatar))), ...await Promise.all(Array.from({ length: N }, () => make("fruit", "locktest")))];

must(await db.from("profiles").update({ credit_balance: 40 }).eq("id", user.id), "set balance");
const charge = (s) => db.rpc(`${s.kind}_charge_step`, {
  p_user_id: user.id, p_story_id: s.id, p_step: "pictures", p_from_statuses: ["draft"], p_to_status: "pictures",
  p_items: [{ scene_id: s.sceneId, kind: "image", tool_key: `image:${s.kind}-story`, price_input: { width: 768, height: 1376 }, request: { test: true }, prompt: "p" }],
});
// Shuffled, and all at once.
const fired = await Promise.all(stories.map((s) => [Math.random(), s]).sort((a, b) => a[0] - b[0]).map(async ([, s]) => ({ s, r: await charge(s) })));
const won = fired.filter((x) => !x.r.error);
const refused = fired.filter((x) => /INSUFFICIENT_CREDITS/.test(x.r.error?.message ?? ""));
const other = fired.filter((x) => x.r.error && !/INSUFFICIENT_CREDITS/.test(x.r.error.message));
ok("exactly 10 of the 30 charges went through", won.length === 10, `${won.filter((x) => x.s.kind === "blocky").length} Blocky + ${won.filter((x) => x.s.kind === "fruit").length} Fruit`);
ok("the other 20 were refused for lack of credits, and for nothing else", refused.length === 20 && other.length === 0, other[0]?.r.error.message ?? "");
ok("the balance ended at exactly 0", (await balance()) === 0, `balance ${await balance()}`);
const ids = stories.map((s) => s.id);
const ledger = async (kind) => must(await db.from(`${kind}_credit_ledger`).select("operation, credits").in("story_id", ids.filter((_, i) => (kind === "blocky" ? i < N : i >= N))), `${kind} ledger`);
const charged = [...await ledger("blocky"), ...await ledger("fruit")].filter((r) => r.operation === "charge").reduce((n, r) => n + r.credits, 0);
ok("the two ledgers together show exactly 40 credits charged", charged === 40, `charged ${charged}`);
const jobs = must(await db.from("blocky_jobs").select("id").in("story_id", ids.slice(0, N)), "jobs").length + must(await db.from("fruit_jobs").select("id").in("story_id", ids.slice(N)), "jobs").length;
ok("a job exists only for a charge that went through", jobs === 10, `${jobs} jobs`);

// One Blocky job, refunded ten times at once.
const paid = won.find((x) => x.s.kind === "blocky");
if (paid) {
  const jobId = paid.r.data.jobs[0].job_id;
  const refunds = await Promise.all(Array.from({ length: 10 }, () => db.rpc("blocky_refund_job", { p_job_id: jobId, p_error_code: "TEST", p_error: "lock test", p_cost_usd: 0 })));
  ok("ten refunds of one job at once: exactly one gives the credits back", refunds.filter((r) => r.data === true).length === 1 && (await balance()) === 4, `balance ${await balance()}`);
} else ok("a Blocky charge went through, to test its refund", false, "all 10 winners were Fruit charges: run it again");

// Tidy up: the test stories go, the balance is what it was.
await db.from("blocky_stories").delete().in("id", ids.slice(0, N));
await db.from("fruit_stories").delete().in("id", ids.slice(N));
must(await db.from("profiles").update({ credit_balance: before }).eq("id", user.id), "restore balance");
console.log(`\n${results.filter(Boolean).length} of ${results.length} checks passed`);
process.exitCode = results.every(Boolean) ? 0 : 1;
