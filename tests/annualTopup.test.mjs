import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// The yearly plans' monthly credit top-up (pg_cron: annual-monthly-credit-topup).
// The SQL itself is executed on an in-memory Postgres by
// tests/annual-topup/simulate.ts; this file guards the shape of the fix.
const root = fileURLToPath(new URL("..", import.meta.url));
const read = (p) => readFileSync(join(root, p), "utf8");
const FIX = "supabase/migrations/20261004201455_annual_topup_fix.sql";
const code = (sql) => sql.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");

test("the job: per-subscriber error handling, grant_credits_once, monthly keys, the paid year only", () => {
  const sql = code(read(FIX));
  assert.doesNotMatch(sql, /grant_id\s+UUID/i, "the uuid variable that broke every run is gone");
  assert.doesNotMatch(sql, /INSERT INTO (public\.)?credit_grants/i, "no direct ledger insert: grant_credits_once writes row and balance together");
  assert.match(sql, /public\.grant_credits_once\(rec\.id, rec\.annual_credits_per_month, 'annual_monthly_topup', v_key\)/);
  assert.match(sql, /v_key := 'annual_' \|\| rec\.id::text \|\| '_' \|\| to_char\(v_due, 'YYYY_MM'\);/);
  assert.match(sql, /EXCEPTION WHEN OTHERS THEN[\s\S]*INSERT INTO public\.annual_topup_failures/, "one subscriber's error is logged, the loop goes on");
  assert.match(sql, /generate_series\(1, 11\)/, "months 1..11: month 0 is paid with the yearly invoice");
  assert.match(sql, /rec\.current_period_end <= p_now/, "nothing outside the paid year");
  assert.match(sql, /NOT IN \('active', 'paid', 'trialing'\)/);
  assert.match(sql, /DROP FUNCTION IF EXISTS public\.topup_annual_credits\(\);/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.topup_annual_credits\(timestamptz\) FROM PUBLIC, anon, authenticated;/);
  assert.doesNotMatch(sql, /cron\.schedule/, "the existing cron job is kept as it is");
  // It runs after the migration that creates grant_credits_once.
  const files = readdirSync(join(root, "supabase/migrations")).sort();
  assert.ok(files.indexOf("20261004201455_annual_topup_fix.sql") > files.indexOf("20261004165741_grant_credits_once.sql"));
});

test("the backfill is a hand-run file, not a migration, and uses the job's keys", () => {
  assert.ok(existsSync(join(root, "supabase/manual/20261004_annual_topup_backfill.sql")));
  assert.ok(!readdirSync(join(root, "supabase/migrations")).some((f) => /backfill/i.test(f)), "never applied automatically");
  const sql = code(read("supabase/manual/20261004_annual_topup_backfill.sql"));
  const rows = [...sql.matchAll(/\('([0-9a-f-]{36})'::uuid,\s+(\d+), 'annual_([0-9a-f-]{36})_(\d{4}_\d{2})'\)/g)];
  assert.equal(rows.length, 17);
  for (const [, user, , keyUser] of rows) assert.equal(user, keyUser, "each key names its own user");
  assert.equal(new Set(rows.map((r) => `${r[1]}_${r[4]}`)).size, 17, "no month twice");
  assert.equal(rows.reduce((s, r) => s + Number(r[2]), 0), 13800);
  assert.match(sql, /public\.grant_credits_once\(b\.user_id, b\.amount, 'annual_monthly_topup', b\.month_key\)/);
});

test("webhook: the paid period on the profile is the latest plan line's end (the job counts back from it)", () => {
  const src = read("supabase/functions/stripe-webhook/index.ts");
  assert.match(src, /const planLineEnds = lines\.filter\(\(ln\) => PRICE_MAP\[ln\?\.price\?\.id\]\)\.map\(\(ln\) => Number\(ln\?\.period\?\.end\) \|\| 0\);/);
  assert.match(src, /unixToIso\(planLineEnds\.length \? Math\.max\(\.\.\.planLineEnds\) : lines\[0\]\?\.period\?\.end\)/);
});
