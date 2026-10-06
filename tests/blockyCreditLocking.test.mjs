// Blocky Stories charges the SAME credit balance as every other tool
// (profiles.credit_balance). These checks pin how Blocky's SQL touches it, so
// a Blocky charge and a Fruit charge at the same moment can never spend the
// same credits:
//
//   - a charge goes through public.deduct_credits (the platform's, the one
//     Fruit's charge uses): ONE statement that takes the profile row's lock
//     and checks the balance in the same breath;
//   - a refund is one statement too, relative to the balance, after the job
//     row is locked and checked, and only once per job;
//   - nothing in Blocky reads the balance first and writes it later, in SQL
//     or in code.
//
// Two real connections racing each other is scripts/blocky/chargeLocking.mjs
// (a throwaway account on the real database). The single-connection run of
// every charge, refund and refusal is scripts/blocky/sql/dryRun.mjs.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const NAME = "20261026100000_blocky_stories_backend.sql";
// Waiting for the owner's go in supabase/pending/; in supabase/migrations/ once it is applied.
const FILE = ["supabase/migrations", "supabase/pending"].map((d) => path.join(ROOT, d, NAME)).find((f) => fs.existsSync(f));
const SQL = fs.readFileSync(FILE, "utf8").replace(/\r\n/g, "\n");
const noComments = (s) => s.replace(/--.*$/gm, "");
/** The body of one function in the file. */
function body(name) {
  const a = SQL.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
  assert.ok(a >= 0, `${name} is defined`);
  const open = SQL.indexOf("$function$", a);
  return noComments(SQL.slice(a, SQL.indexOf("$function$", open + 1)));
}

test("a charge: story and scene rows locked, then ONE call to the platform's deduct_credits", () => {
  const f = body("blocky_charge_step");
  assert.match(f, /FROM public\.blocky_stories WHERE id = p_story_id AND deleted_at IS NULL FOR UPDATE;/, "the story row is locked for the step");
  assert.match(f, /FROM public\.blocky_story_scenes WHERE id = \(v_item->>'scene_id'\)::uuid AND story_id = p_story_id FOR UPDATE;/, "each scene row is locked");
  assert.equal(f.split("public.deduct_credits(").length - 1, 1, "credits leave in one place");
  assert.match(f, /IF v_total > 0 THEN\s+PERFORM public\.deduct_credits\(p_user_id, v_total\);\s+END IF;/);
  // The whole step is priced on the server before anything is deducted, and deducted once for the whole step.
  assert.ok(f.indexOf("public.compute_tool_price(") < f.indexOf("public.deduct_credits("), "priced first");
  assert.ok(f.indexOf("public.deduct_credits(") < f.indexOf("INSERT INTO public.blocky_jobs"), "charged before any job exists");
  // It never touches the balance itself.
  assert.doesNotMatch(f, /credit_balance/);
  assert.doesNotMatch(f, /UPDATE public\.profiles/);
});

test("the platform's deduct_credits is one statement that locks the row and checks the balance together", () => {
  // Its latest definition in the repo (Blocky does not define or change it).
  const dir = path.join(ROOT, "supabase/migrations");
  const latest = fs.readdirSync(dir).sort().reverse().map((f) => fs.readFileSync(path.join(dir, f), "utf8")).find((t) => /CREATE OR REPLACE FUNCTION public\.deduct_credits\(/.test(t));
  const a = latest.lastIndexOf("CREATE OR REPLACE FUNCTION public.deduct_credits(");
  const f = noComments(latest.slice(a, latest.indexOf("$$;", a) > 0 ? latest.indexOf("$$;", a) : latest.indexOf("$function$;", a))).replace(/\s+/g, " ");
  assert.match(f, /UPDATE public\.profiles SET credit_balance = credit_balance - amount, credits_spent_today = credits_spent_today \+ amount WHERE id = uid AND credit_balance >= amount; IF NOT FOUND THEN RAISE EXCEPTION 'INSUFFICIENT_CREDITS'/);
  assert.doesNotMatch(f, /SELECT credit_balance/i, "no read-then-write");
});

test("a refund: the job row is locked and checked, the credits go back in one relative statement, once", () => {
  const f = body("blocky_refund_job");
  const lock = f.indexOf("FROM public.blocky_jobs WHERE id = p_job_id FOR UPDATE;");
  const guard = f.indexOf("v_job.status IN ('succeeded', 'failed', 'canceled') OR v_job.refunded_at IS NOT NULL");
  const give = f.indexOf("SET credit_balance = credit_balance + v_job.credits");
  const mark = f.indexOf("refunded_at = now()");
  assert.ok(lock >= 0 && guard > lock && give > guard && mark > give, "lock → already finished or refunded? → give back → mark refunded");
  assert.match(f, /WHERE id = v_job\.user_id;/);
  assert.match(f, /'job:' \|\| p_job_id \|\| ':refund', p_error_code\)\s+ON CONFLICT \(idempotency_key\) DO NOTHING;/, "the ledger can hold one refund per job");
  assert.equal(f.split("credit_balance =").length - 1, 1);
});

test("finishing a job locks the job row and never touches credits", () => {
  const f = body("blocky_complete_job");
  assert.match(f, /FROM public\.blocky_jobs WHERE id = p_job_id FOR UPDATE;/);
  assert.doesNotMatch(f, /credit_balance|deduct_credits|profiles/);
});

test("the balance is only ever written relative to itself, and only in the refund", () => {
  const sql = noComments(SQL);
  const writes = [...sql.matchAll(/credit_balance\s*=\s*([^,\n]+)/g)].map((m) => m[1].trim());
  assert.deepEqual(writes, ["credit_balance + v_job.credits"]);
  assert.doesNotMatch(sql, /INTO\s+\w+\s+FROM public\.profiles[^;]*credit_balance|SELECT credit_balance/i, "the balance is never read into a variable");
  assert.equal(sql.split("public.deduct_credits(").length - 1, 1);
});

test("Blocky's SQL names no Fruit object", () => {
  assert.doesNotMatch(noComments(SQL), /fruit/i);
});

test("Blocky's code never writes credits: only the two SQL functions do", () => {
  const dirs = ["supabase/functions/_shared/blocky", "supabase/functions/blocky-story-api", "supabase/functions/blocky-worker", "src/components/viral-tools/blocky-stories"];
  const walk = (rel) => fs.readdirSync(path.join(ROOT, rel), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(`${rel}/${e.name}`) : [`${rel}/${e.name}`]));
  let rpc = 0;
  for (const f of dirs.flatMap(walk).filter((x) => /\.(js|jsx|ts)$/.test(x))) {
    const text = fs.readFileSync(path.join(ROOT, f), "utf8");
    assert.doesNotMatch(text, /credit_balance|deduct_credits|credits_spent_today/, `${f} touches the balance`);
    rpc += text.split('rpc("blocky_charge_step"').length - 1;
  }
  assert.ok(rpc >= 1, "paid steps go through blocky_charge_step");
});
