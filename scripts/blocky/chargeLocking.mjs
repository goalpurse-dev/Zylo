// Two products, one credit balance, charged at the same moment: a race on the
// REAL database with real connections, on a throwaway account. It calls no
// provider and costs $0. No real user's credits can move: every call names
// the throwaway account's id, and the script proves it by comparing every
// other balance before and after.
//
//   1. A throwaway account is created and given the Starter plan and 40
//      credits: enough for exactly 10 pictures (4 credits each).
//   2. 30 charges are fired at once for that account:
//        15 through blocky_charge_step (each on its own Blocky story), and
//        15 through deduct_credits(4), the one statement AI Fruit Story's
//        charge runs to take credits.
//      (Not fruit_charge_step itself: it would leave queued Fruit jobs that
//      the live Fruit sweep sends to Runware within 20 seconds.)
//   3. Exactly 10 must go through and 20 must be refused for lack of credits;
//      the balance must end at exactly 0; Blocky's ledger plus the direct
//      deductions must add up to exactly 40.
//   4. One charged Blocky job is refunded 10 times at once: 4 credits must
//      come back exactly once.
//   5. The account and every row it made are deleted.
//
// The Blocky jobs it creates stay "queued" for a few seconds and go nowhere:
// nothing kicks the worker, and Blocky's paid calls must be OFF (checked).
//
//   node scripts/blocky/chargeLocking.mjs
import { admin } from "./lib.mjs";

const EMAIL = "upwardlift6+blockylocktest@gmail.com";
const db = admin();
const must = ({ data, error }, what) => { if (error) throw new Error(`${what}: ${error.message}`); return data; };
const results = [];
const ok = (name, cond, detail = "") => { results.push(Boolean(cond)); console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`); };
const findUser = async () => {
  for (let page = 1; page <= 50; page++) {
    const users = must(await db.auth.admin.listUsers({ page, perPage: 1000 }), "list users").users;
    const hit = users.find((u) => u.email === EMAIL);
    if (hit || users.length < 1000) return hit ?? null;
  }
  return null;
};
/** Every balance but the throwaway account's. */
async function otherBalances(exceptId) {
  const map = new Map();
  for (let from = 0; ; from += 1000) {
    const rows = must(await db.from("profiles").select("id, credit_balance").order("id").range(from, from + 999), "profiles");
    for (const r of rows) if (r.id !== exceptId) map.set(r.id, r.credit_balance);
    if (rows.length < 1000) return map;
  }
}
async function remove(userId) {
  const del = await db.auth.admin.deleteUser(userId);
  if (del.error) {
    // The account's rows first, then the account.
    await db.from("blocky_stories").delete().eq("user_id", userId);
    await db.from("user_balances").delete().eq("user_id", userId);
    await db.from("profiles").delete().eq("id", userId);
    must(await db.auth.admin.deleteUser(userId), "delete the throwaway account");
  }
}

// Paid calls must be off, so a job this test leaves queued for a moment can never reach a provider.
const paid = must(await db.rpc("blocky_paid_state", { p_add_usd: 0 }), "paid state");
if (paid.paid_calls) { console.error("Blocky's paid calls are ON. Turn them off first: node scripts/blocky/paid.mjs off"); process.exit(2); }
const avatar = must(await db.from("blocky_characters").select("id").limit(1), "avatars")[0]?.id;
if (!avatar) { console.error("No avatar yet: run node scripts/blocky/seedTemporaryAvatars.mjs"); process.exit(2); }
const leftover = await findUser();
if (leftover) { console.log("A throwaway account from an earlier run is still there: deleting it first."); await remove(leftover.id); }

const user = must(await db.auth.admin.createUser({ email: EMAIL, password: `${crypto.randomUUID()}Aa1!`, email_confirm: true }), "create the throwaway account").user;
let exitCode = 1;
try {
  const before = await otherBalances(user.id);
  must(await db.from("profiles").update({ plan_code: "starter", credit_balance: 40 }).eq("id", user.id).select("id"), "set plan and balance");
  const balance = async () => must(await db.from("profiles").select("credit_balance").eq("id", user.id).single(), "balance").credit_balance;
  ok("the throwaway account starts with 40 credits", (await balance()) === 40);

  const N = 15;
  const story = { source: "prompt", input: {}, title: "Lock test", cast_ids: [avatar], quality: "v2", aspect: "9:16", length_sec: 5, locations: [], planner: {} };
  const scene = [{ title: "t", speaker_id: avatar, line: "One line.", present_ids: [avatar], location_id: "loc1", action: "a", emotion: "e", shot: "close-up", placement: "", duration_sec: 5 }];
  const stories = await Promise.all(Array.from({ length: N }, async () => {
    const id = must(await db.rpc("blocky_create_story", { p_user_id: user.id, p_story: story, p_scenes: scene, p_call_ids: [] }), "blocky_create_story");
    return { id, sceneId: must(await db.from("blocky_story_scenes").select("id").eq("story_id", id).single(), "scene").id };
  }));
  const blockyCharge = (s) => db.rpc("blocky_charge_step", {
    p_user_id: user.id, p_story_id: s.id, p_step: "pictures", p_from_statuses: ["draft"], p_to_status: "pictures",
    p_items: [{ scene_id: s.sceneId, kind: "image", tool_key: "image:blocky-story", price_input: { width: 768, height: 1376 }, request: { test: true }, prompt: "p" }],
  });
  const fruitDeduct = () => db.rpc("deduct_credits", { uid: user.id, amount: 4 });
  // Shuffled, and all at once.
  const calls = [...stories.map((s) => ({ kind: "blocky", run: () => blockyCharge(s) })), ...Array.from({ length: N }, () => ({ kind: "fruit", run: fruitDeduct }))]
    .map((c) => [Math.random(), c]).sort((a, b) => a[0] - b[0]).map(([, c]) => c);
  const fired = await Promise.all(calls.map(async (c) => ({ kind: c.kind, r: await c.run() })));
  const won = fired.filter((x) => !x.r.error);
  const refused = fired.filter((x) => /INSUFFICIENT_CREDITS/.test(x.r.error?.message ?? ""));
  const other = fired.filter((x) => x.r.error && !/INSUFFICIENT_CREDITS/.test(x.r.error.message));
  const wonBlocky = won.filter((x) => x.kind === "blocky");
  const wonFruit = won.filter((x) => x.kind === "fruit");
  ok("exactly 10 of the 30 charges went through", won.length === 10, `${wonBlocky.length} through Blocky's charge + ${wonFruit.length} through Fruit's deduction`);
  ok("the other 20 were refused for lack of credits, and for nothing else", refused.length === 20 && other.length === 0, other[0]?.r.error.message ?? "");
  ok("the balance ended at exactly 0, never below", (await balance()) === 0, `balance ${await balance()}`);
  const ledger = must(await db.from("blocky_credit_ledger").select("operation, credits").eq("user_id", user.id), "ledger");
  const charged = ledger.filter((r) => r.operation === "charge").reduce((n, r) => n + r.credits, 0);
  ok("Blocky's ledger plus the direct deductions add up to exactly 40 credits", charged + 4 * wonFruit.length === 40 && charged === 4 * wonBlocky.length, `ledger ${charged} + direct ${4 * wonFruit.length}`);
  const jobs = must(await db.from("blocky_jobs").select("id, status").eq("user_id", user.id), "jobs");
  ok("a Blocky job exists only for a charge that went through", jobs.length === wonBlocky.length, `${jobs.length} jobs`);

  if (wonBlocky.length) {
    const jobId = wonBlocky[0].r.data.jobs[0].job_id;
    const refunds = await Promise.all(Array.from({ length: 10 }, () => db.rpc("blocky_refund_job", { p_job_id: jobId, p_error_code: "TEST", p_error: "lock test", p_cost_usd: 0 })));
    ok("ten refunds of one job at once: exactly one gives the 4 credits back", refunds.filter((r) => r.data === true).length === 1 && refunds.every((r) => !r.error) && (await balance()) === 4, `balance ${await balance()}`);
  } else ok("a Blocky charge went through, to test its refund", false, "all 10 winners were direct deductions: run it again");

  const after = await otherBalances(user.id);
  const moved = [...before].filter(([id, credits]) => after.get(id) !== credits).length;
  ok(`no other account's balance moved (${before.size} accounts compared)`, moved === 0 && after.size === before.size, moved ? `${moved} changed: someone used the app during the test, or this is a real problem; run again to tell` : "");
  exitCode = results.every(Boolean) ? 0 : 1;
} finally {
  await remove(user.id);
  const left = {
    account: Boolean(await findUser()),
    profile: must(await db.from("profiles").select("id").eq("id", user.id), "profile").length,
    stories: must(await db.from("blocky_stories").select("id").eq("user_id", user.id), "stories").length,
    jobs: must(await db.from("blocky_jobs").select("id").eq("user_id", user.id), "jobs").length,
    ledger: must(await db.from("blocky_credit_ledger").select("id").eq("user_id", user.id), "ledger").length,
    charges: must(await db.from("blocky_charges").select("id").eq("user_id", user.id), "charges").length,
  };
  ok("the throwaway account and every row it made are gone", !left.account && !left.profile && !left.stories && !left.jobs && !left.ledger && !left.charges, JSON.stringify(left));
}
console.log(`\n${results.filter(Boolean).length} of ${results.length} checks passed`);
process.exitCode = results.every(Boolean) ? exitCode : 1;
