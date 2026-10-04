// Runs the REAL SQL of the yearly top-up job on an in-memory Postgres (PGlite):
// the migrations are read from supabase/migrations and executed as they are.
// No network, no keys, no connection to any database. Exits 1 if a check fails.
// From the repo root:
//   npx -y deno@2.9.6 run --allow-read --allow-env --no-lock --no-config tests/annual-topup/simulate.ts
// Covers: the original bug, grant_credits_once itself, once per month, who is
// skipped, one broken row, running twice, a whole year day by day, the plan
// switching fields, and the hand-run backfill (supabase/manual/).
// deno-lint-ignore-file no-explicit-any
import { PGlite } from "npm:@electric-sql/pglite@0.2.17";

const read = (p: string) => Deno.readTextFileSync(new URL(`../../${p}`, import.meta.url));
const GRANT_ONCE = read("supabase/migrations/20261004165741_grant_credits_once.sql");
const TOPUP_FIX = read("supabase/migrations/20261004201455_annual_topup_fix.sql");
const OLD_BILLING = read("supabase/migrations/20260518000000_annual_billing.sql");
const BACKFILL = read("supabase/manual/20261004_annual_topup_backfill.sql");

let failed = 0;
function check(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? "  ok " : "FAIL "} ${name}${ok ? "" : `  got ${JSON.stringify(got)} want ${JSON.stringify(want)}`}`);
}

// The tables as production has them (credit_grants.id is a bigint: the bug).
const SCHEMA = `
  create role anon; create role authenticated; create role service_role;
  create table public.profiles (
    id uuid primary key, plan_code text default 'free',
    credit_balance integer not null default 0 check (credit_balance >= 0),
    billing_interval text default 'monthly', annual_credits_per_month integer default 0, annual_credits_last_topup timestamptz,
    stripe_subscription_id text, stripe_subscription_status text, current_period_end timestamptz);
  create table public.credit_grants (
    id bigint generated always as identity primary key, created_at timestamptz default now(),
    user_id uuid not null, reason text not null, amount integer not null, external_id text);
`;
async function freshDb(opts: { fixed: boolean }) {
  const db = new PGlite();
  await db.exec("set timezone = 'UTC';");
  await db.exec(SCHEMA);
  if (opts.fixed) { await db.exec(GRANT_ONCE); await db.exec(TOPUP_FIX); }
  return db;
}
const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
type User = { plan?: string; interval?: string; perMonth?: number; status?: string | null; sub?: string | null; end?: string | null; balance?: number; lastTopup?: string | null };
async function addUser(db: PGlite, id: string, u: User) {
  await db.query(
    `insert into public.profiles (id, plan_code, billing_interval, annual_credits_per_month, stripe_subscription_status, stripe_subscription_id, current_period_end, credit_balance, annual_credits_last_topup)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [id, u.plan ?? "starter", u.interval ?? "yearly", u.perMonth ?? 600, u.status === undefined ? "paid" : u.status, u.sub === undefined ? "sub_x" : u.sub, u.end === undefined ? "2027-06-01T01:50:05Z" : u.end, u.balance ?? 0, u.lastTopup ?? null],
  );
}
// The job's summary, with its fields in a fixed order (jsonb sorts keys its own way).
const run = async (db: PGlite, now: string) => {
  const r = (await db.query<{ r: any }>("select public.topup_annual_credits($1::timestamptz) as r", [now])).rows[0].r;
  return { checked: r.checked, granted: r.granted, already_granted: r.already_granted, skipped: r.skipped, failed: r.failed };
};
const balance = async (db: PGlite, id: string) => (await db.query<{ credit_balance: number }>("select credit_balance from public.profiles where id = $1", [id])).rows[0].credit_balance;
const grants = async (db: PGlite, id: string) => (await db.query<{ g: string }>("select reason || ':' || amount || ':' || right(external_id, 7) as g from public.credit_grants where user_id = $1 order by external_id", [id])).rows.map((r) => r.g);
const one = async (db: PGlite, sql: string, params: any[] = []) => Object.values((await db.query<any>(sql, params)).rows[0] ?? {})[0];

// ============================================================
console.log("\n1. The original bug, reproduced with the function as it was deployed");
{
  const db = await freshDb({ fixed: false });
  const oldFn = OLD_BILLING.match(/CREATE OR REPLACE FUNCTION topup_annual_credits\(\)[\s\S]*?\n\$\$;/)?.[0];
  check("the old function is found in 20260518000000_annual_billing.sql", Boolean(oldFn), true);
  await db.exec("create unique index credit_grants_external_id_key on public.credit_grants (external_id);");
  await db.exec(oldFn!);
  await addUser(db, U(1), {});
  await addUser(db, U(2), { plan: "pro", perMonth: 1200 });
  let error = "";
  try { await db.query("select topup_annual_credits()"); } catch (e) { error = String((e as Error).message); }
  check("it fails with the error from cron.job_run_details", /invalid input syntax for type uuid: "\d+"/.test(error), true);
  console.log(`        → ${error}`);
  check("…and nobody got anything: the first error ended the whole run", [await balance(db, U(1)), await balance(db, U(2)), await one(db, "select count(*)::int from public.credit_grants")], [0, 0, 0]);
  await db.close();
}

console.log("\n2. grant_credits_once on a real Postgres");
{
  const db = await freshDb({ fixed: true });
  await addUser(db, U(1), { balance: 100 });
  check("first call grants → true, balance 100 + 600", [await one(db, "select public.grant_credits_once($1, 600, 'annual_monthly_topup', 'k1')", [U(1)]), await balance(db, U(1))], [true, 700]);
  check("same key again → false, balance unchanged", [await one(db, "select public.grant_credits_once($1, 600, 'annual_monthly_topup', 'k1')", [U(1)]), await balance(db, U(1))], [false, 700]);
  let err = "";
  try { await db.query("select public.grant_credits_once($1, 600, 'x', 'k2')", [U(99)]); } catch (e) { err = String((e as Error).message); }
  check("a missing profile raises, and the ledger row is rolled back with it", [/no profile/.test(err), await one(db, "select count(*)::int from public.credit_grants where external_id = 'k2'")], [true, 0]);
  err = "";
  try { await db.query("select public.grant_credits_once($1, 0, 'x', 'k3')", [U(1)]); } catch (e) { err = String((e as Error).message); }
  check("an amount of 0 raises", /amount must be positive/.test(err), true);
  await db.close();
}

console.log("\n3. One run: who gets a top-up, who is skipped, one broken row");
const NOW = "2026-10-04T06:00:00Z"; // the job runs daily at 06:00 UTC
{
  const db = await freshDb({ fixed: true });
  await addUser(db, U(1), { end: "2027-06-01T01:50:05Z" });                               // started 1 Jun: month 4 fell due 1 Oct
  await addUser(db, U(2), { plan: "pro", perMonth: 1200, end: "2027-06-07T06:55:22Z" });  // started 7 Jun: month 3 fell due 7 Sep (7 Oct is not here yet)
  await addUser(db, U(3), { interval: "monthly", perMonth: 0, end: "2026-11-01T00:00:00Z" });  // monthly plan
  await addUser(db, U(4), { status: "canceled" });
  await addUser(db, U(5), { status: "unpaid" });
  await addUser(db, U(6), { status: "past_due" });
  await addUser(db, U(7), { perMonth: 0 });
  await addUser(db, U(8), { end: "2026-09-01T00:00:00Z" });      // the paid year is over
  await addUser(db, U(9), { end: "2027-09-20T00:00:00Z" });      // started 20 Sep: still in the month the invoice paid for
  await addUser(db, U(10), { sub: null });                       // no subscription
  await addUser(db, U(11), { plan: "free" });                    // plan already removed
  await addUser(db, U(12), {});                                  // BROKEN: its grant will raise
  await addUser(db, U(13), { end: null });                       // BROKEN: no paid period on record
  await db.exec(`
    create function public.break_one() returns trigger language plpgsql as $$
    begin if new.user_id = '${U(12)}' then raise exception 'simulated failure for this row'; end if; return new; end $$;
    create trigger break_one before insert on public.credit_grants for each row execute function public.break_one();`);

  const first = await run(db, NOW);
  check("run 1: 12 yearly profiles checked, 2 granted, 8 skipped, 2 failed", first, { checked: 12, granted: 2, already_granted: 0, skipped: 8, failed: 2 });
  check("Starter (started 1 Jun) gets 600 for October, keyed annual_<user>_2026_10", [await balance(db, U(1)), await grants(db, U(1))], [600, ["annual_monthly_topup:600:2026_10"]]);
  check("the full key is annual_<user>_<YYYY_MM>", await one(db, "select external_id from public.credit_grants where user_id = $1", [U(1)]), `annual_${U(1)}_2026_10`);
  check("Pro (started 7 Jun) gets 1,200 for the month that fell due 7 Sep", [await balance(db, U(2)), await grants(db, U(2))], [1200, ["annual_monthly_topup:1200:2026_09"]]);
  check("the credit month's start is stored for the upgrade formula", (await one(db, "select annual_credits_last_topup from public.profiles where id = $1", [U(1)]) as Date).toISOString(), "2026-10-01T01:50:05.000Z");
  check("monthly, canceled, unpaid, past due, no amount, year over, first month, no subscription, free: nothing", await Promise.all([3, 4, 5, 6, 7, 8, 9, 10, 11].map((n) => balance(db, U(n)))), [0, 0, 0, 0, 0, 0, 0, 0, 0]);
  check("the two broken rows got nothing, and did not stop the others", [await balance(db, U(12)), await balance(db, U(13))], [0, 0]);
  const fails = (await db.query<any>("select user_id, external_id, error from public.annual_topup_failures order by user_id")).rows;
  check("each failure is logged with its user (and the month's key when it got that far)", fails.map((f: any) => [f.user_id, f.external_id?.slice(-7) ?? null, f.error]), [
    [U(12), "2026_10", "simulated failure for this row"],
    [U(13), null, "yearly subscriber without current_period_end: the paid year is unknown"],
  ]);

  const second = await run(db, NOW);
  check("run 2, SAME DAY: nothing granted again", second, { checked: 12, granted: 0, already_granted: 2, skipped: 8, failed: 2 });
  check("balances unchanged, one ledger row each", [await balance(db, U(1)), await balance(db, U(2)), await one(db, "select count(*)::int from public.credit_grants")], [600, 1200, 2]);
  check("the next day: still the same month, nothing new", (await run(db, "2026-10-05T06:00:00Z")).granted, 0);

  check("8 Oct (Pro's month fell due on the 7th): Pro gets October, Starter has it already", [(await run(db, "2026-10-08T06:00:00Z")).granted, await grants(db, U(2))], [1, ["annual_monthly_topup:1200:2026_09", "annual_monthly_topup:1200:2026_10"]]);
  await run(db, "2026-11-02T06:00:00Z");
  check("2 Nov: Starter gets November", await grants(db, U(1)), ["annual_monthly_topup:600:2026_10", "annual_monthly_topup:600:2026_11"]);
  check("…and the subscriber who started 20 Sep gets their first top-up (it fell due 20 Oct)", await grants(db, U(9)), ["annual_monthly_topup:600:2026_10"]);
  check("the job never reaches back: July–September are not granted by it (that is the backfill)", (await grants(db, U(1))).length, 2);

  // plan switching: the webhook raises the monthly amount on a mid-year upgrade
  await db.query("update public.profiles set plan_code = 'pro', annual_credits_per_month = 1600 where id = $1", [U(1)]);
  check("after a mid-year upgrade to Pro (webhook set 1,600): December's top-up is 1,600", [(await run(db, "2026-12-02T06:00:00Z")).granted >= 1, (await grants(db, U(1))).at(-1)], [true, "annual_monthly_topup:1600:2026_12"]);
  await db.close();
}

console.log("\n4. A whole paid year, the job run every day (and twice a day)");
{
  const db = await freshDb({ fixed: true });
  await addUser(db, U(1), { end: "2027-01-31T10:00:00Z" });                 // started 31 Jan 2026: month-end anchor
  await addUser(db, U(2), { plan: "pro", perMonth: 750, end: "2027-06-15T12:00:00Z" });
  let runs = 0;
  for (let t = Date.parse("2026-01-31T06:00:00Z"); t <= Date.parse("2027-08-01T06:00:00Z"); t += 86400000) {
    await run(db, new Date(t).toISOString()); await run(db, new Date(t + 3600000).toISOString()); runs += 2;
  }
  check(`${runs} runs: exactly 11 top-ups in the paid year (month 0 is the invoice), none after it ended`, await grants(db, U(1)), ["02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"].map((m) => `annual_monthly_topup:600:2026_${m}`));
  check("11 × 600 = 6,600", await balance(db, U(1)), 6600);
  check("a subscriber who started 15 Jun: 11 top-ups, Jul 2026 … May 2027", (await grants(db, U(2))).map((g) => g.slice(-7)), ["2026_07", "2026_08", "2026_09", "2026_10", "2026_11", "2026_12", "2027_01", "2027_02", "2027_03", "2027_04", "2027_05"]);
  check("no failures logged", await one(db, "select count(*)::int from public.annual_topup_failures"), 0);
  await db.close();
}

console.log("\n5. The last month of the year after a capped upgrade, then the renewal");
{
  const db = await freshDb({ fixed: true });
  // Upgraded to Pro 3 days before the year ends: the webhook granted 84 credits
  // and LEFT the monthly amount at 750 until the renewal is paid.
  await addUser(db, U(1), { plan: "pro", perMonth: 750, end: "2026-10-07T00:00:00Z", lastTopup: "2026-09-07T00:00:00Z" });
  check("in the last month the top-up stays 750", [(await run(db, "2026-10-04T06:00:00Z")).granted, await grants(db, U(1))], [1, ["annual_monthly_topup:750:2026_09"]]);
  // The renewal invoice is paid: the webhook grants month 0 itself and sets the new year.
  await db.query("update public.profiles set annual_credits_per_month = 1600, current_period_end = '2027-10-07T00:00:00Z', annual_credits_last_topup = '2026-10-07T00:00:00Z' where id = $1", [U(1)]);
  check("after the paid renewal: nothing in month 0 (the invoice paid it)", (await run(db, "2026-10-20T06:00:00Z")).granted, 0);
  check("…then 1,600 from the first top-up of the new year", [(await run(db, "2026-11-08T06:00:00Z")).granted, (await grants(db, U(1))).at(-1)], [1, "annual_monthly_topup:1600:2026_11"]);
  await db.close();
}

console.log("\n6. The backfill (supabase/manual/20261004_annual_topup_backfill.sql), as it will be run");
{
  const db = await freshDb({ fixed: true });
  const real: [string, string, number, string][] = [
    ["5d598d4d-f63b-4784-81d2-0c83bff83897", "starter", 600, "2027-06-01T01:50:05Z"],
    ["550ee7ed-2c72-4578-8a9a-7c61cd645307", "pro", 1200, "2027-06-07T06:55:22Z"],
    ["f01f21bd-b4a3-4476-88b1-96c5492c00d0", "starter", 600, "2027-07-03T14:23:59Z"],
    ["7b60f3a8-a99e-4072-a5bc-841f80d24e58", "pro", 1200, "2027-07-03T20:31:53Z"],
    ["490e4f3e-8e9b-4377-81a7-9a77b9918911", "starter", 600, "2027-07-06T04:31:24Z"],
    ["f81f4464-3a55-4e03-9a28-dfd08d0a0a9c", "starter", 600, "2027-07-23T14:26:08Z"],
  ];
  // As they are today: the first month's credits (from the invoice), nothing since.
  for (const [id, plan, perMonth, end] of real) await addUser(db, id, { plan, perMonth, end, balance: perMonth, lastTopup: new Date(Date.parse(end) - 365 * 86400000).toISOString() });
  const READ_AT = "2026-10-04T17:13:00Z";
  // What is owed, worked out independently of the file: every month that fell due inside the paid year.
  const owed = (await db.query<any>(`
    select p.id, count(*)::int as months, (count(*) * p.annual_credits_per_month)::int as credits,
           array_agg('annual_' || p.id || '_' || to_char(p.current_period_end - interval '1 year' + make_interval(months => k), 'YYYY_MM') order by k) as keys
    from public.profiles p, generate_series(1, 11) k
    where p.current_period_end - interval '1 year' + make_interval(months => k) <= $1::timestamptz
    group by p.id, p.annual_credits_per_month`, [READ_AT])).rows;
  const owedById = Object.fromEntries(owed.map((o: any) => [o.id, o]));
  check("owed months per subscriber: 4, 3, 3, 3, 2, 2", real.map(([id]) => owedById[id].months), [4, 3, 3, 3, 2, 2]);
  check("owed credits per subscriber: 2,400 / 3,600 / 1,800 / 3,600 / 1,200 / 1,200", real.map(([id]) => owedById[id].credits), [2400, 3600, 1800, 3600, 1200, 1200]);

  const results = await db.exec(BACKFILL);
  const grantRows = results[0].rows as any[];
  check("the file grants 17 months, every one granted = true", [grantRows.length, grantRows.every((r) => r.granted === true)], [17, true]);
  const got = (await db.query<any>("select user_id, array_agg(external_id order by external_id) as keys, sum(amount)::int as credits from public.credit_grants group by user_id")).rows;
  const gotById = Object.fromEntries(got.map((g: any) => [g.user_id, g]));
  check("its keys are exactly the months owed (the job's own keys)", real.map(([id]) => gotById[id].keys), real.map(([id]) => owedById[id].keys));
  check("its amounts are exactly the credits owed; 13,800 in total", [real.map(([id]) => gotById[id].credits), await one(db, "select sum(amount)::int from public.credit_grants")], [[2400, 3600, 1800, 3600, 1200, 1200], 13800]);
  check("balances: first month + backfill", await Promise.all(real.map(([id]) => balance(db, id))), [3000, 4800, 2400, 4800, 1800, 1800]);

  check("the fixed job right after the backfill: every current month is already granted", await run(db, "2026-10-04T18:00:00Z"), { checked: 6, granted: 0, already_granted: 6, skipped: 0, failed: 0 });
  const again = await db.exec(BACKFILL);
  check("the backfill run a SECOND time: 17 rows, all granted = false, total still 13,800", [(again[0].rows as any[]).length, (again[0].rows as any[]).every((r) => r.granted === false), await one(db, "select sum(amount)::int from public.credit_grants")], [17, true, 13800]);
  check("8 Oct: the job grants October to the two whose month fell due on the 6th and 7th", [(await run(db, "2026-10-08T06:00:00Z")).granted, await balance(db, real[1][0]), await balance(db, real[4][0])], [2, 6000, 2400]);
  await db.close();
}

console.log("\n7. The other order: the job first, the backfill afterwards");
{
  const db = await freshDb({ fixed: true });
  await addUser(db, "5d598d4d-f63b-4784-81d2-0c83bff83897", { perMonth: 600, end: "2027-06-01T01:50:05Z", balance: 600 });
  for (const [id, perMonth, end] of [["550ee7ed-2c72-4578-8a9a-7c61cd645307", 1200, "2027-06-07T06:55:22Z"], ["f01f21bd-b4a3-4476-88b1-96c5492c00d0", 600, "2027-07-03T14:23:59Z"], ["7b60f3a8-a99e-4072-a5bc-841f80d24e58", 1200, "2027-07-03T20:31:53Z"], ["490e4f3e-8e9b-4377-81a7-9a77b9918911", 600, "2027-07-06T04:31:24Z"], ["f81f4464-3a55-4e03-9a28-dfd08d0a0a9c", 600, "2027-07-23T14:26:08Z"]] as [string, number, string][]) await addUser(db, id, { perMonth, end, balance: perMonth });
  check("job runs first (5 Oct 06:00): the six current months", (await run(db, "2026-10-05T06:00:00Z")).granted, 6);
  const rows = (await db.exec(BACKFILL))[0].rows as any[];
  check("the backfill then adds only the 11 months the job did not: no month twice", [rows.filter((r) => r.granted).length, rows.filter((r) => !r.granted).length, await one(db, "select sum(amount)::int from public.credit_grants"), await one(db, "select count(*)::int from (select external_id from public.credit_grants group by 1 having count(*) > 1) d")], [11, 6, 13800, 0]);
  await db.close();
}

console.log(failed ? `\n${failed} CHECK(S) FAILED` : "\nall checks passed");
Deno.exit(failed ? 1 : 0);
