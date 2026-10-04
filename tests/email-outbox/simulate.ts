// Runs the REAL outbox SQL (the migration, read from supabase/migrations) on an
// in-memory Postgres (PGlite) and the REAL sender logic and templates
// (_shared/emails) against a fake Resend. No network, no keys, nothing is sent.
// Exits 1 if a check fails. From the repo root:
//   npx -y deno@2.9.6 run --allow-read --allow-env --no-lock --no-config tests/email-outbox/simulate.ts
// deno-lint-ignore-file no-explicit-any
import { PGlite } from "npm:@electric-sql/pglite@0.2.17";
import { processOutbox, unsubscribeLinks } from "../../supabase/functions/_shared/emails/outbox.js";
import { REPLY_TO, SENDERS } from "../../supabase/functions/_shared/emails/templates.js";

const read = (p: string) => Deno.readTextFileSync(new URL(`../../${p}`, import.meta.url));
// pg_cron, pg_net and Vault don't exist in PGlite: minimal stand-ins with the
// same names, so the migration's functions run unchanged.
const STUBS = `
  create role anon; create role authenticated; create role service_role;
  create table public.profiles (
    id uuid primary key, email text, plan_code text default 'free', credit_balance integer not null default 0,
    email_updates boolean, welcome_email_sent boolean not null default false);
  create table public.annual_topup_failures (id bigint generated always as identity primary key, created_at timestamptz not null default now(), user_id uuid, external_id text, sqlstate text, error text not null);
  create schema cron;
  create table cron.job (jobid bigint primary key, jobname text);
  create table cron.job_run_details (jobid bigint, status text, return_message text, start_time timestamptz default now());
  create schema net;
  create table net._http_response (id bigserial primary key, status_code integer, content text, error_msg text, created timestamptz default now());
  create table net.calls (id bigserial primary key, url text, headers jsonb, body jsonb);
  create function net.http_post(url text, headers jsonb, body jsonb) returns bigint language sql as $$ insert into net.calls (url, headers, body) values ($1, $2, $3) returning id $$;
  create schema vault;
  create table vault.decrypted_secrets (name text, decrypted_secret text, created_at timestamptz default now());
`;
const MIGRATION = read("supabase/migrations/20261004212405_email_outbox.sql").replace(/^CREATE EXTENSION IF NOT EXISTS .*;$/gm, "");

let failed = 0;
function check(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? "  ok " : "FAIL "} ${name}${ok ? "" : `  got ${JSON.stringify(got)} want ${JSON.stringify(want)}`}`);
}
const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

async function freshDb() {
  const db = new PGlite();
  await db.exec("set timezone = 'UTC';");
  await db.exec(STUBS);
  await db.exec(MIGRATION);
  return db;
}
const one = async (db: PGlite, sql: string, params: any[] = []) => Object.values((await db.query<any>(sql, params)).rows[0] ?? {})[0];
const rows = async (db: PGlite, sql: string, params: any[] = []) => (await db.query<any>(sql, params)).rows;
const addProfile = (db: PGlite, id: string, p: any = {}) =>
  db.query("insert into public.profiles (id, email, plan_code, credit_balance, email_updates, welcome_email_sent) values ($1, $2, $3, $4, $5, $6)",
    [id, p.email === undefined ? `user${id.slice(-3)}@example.com` : p.email, p.plan ?? "free", p.balance ?? 0, p.updates ?? null, p.welcomed ?? false]);
const enqueue = (db: PGlite, key: string, template: string, user: string | null, payload: any = {}, category = "transactional", toEmail: string | null = null) =>
  one(db, "select public.enqueue_email($1, $2, $3, $4::jsonb, $5, now(), $6)", [key, template, user, JSON.stringify(payload), category, toEmail]);
const status = async (db: PGlite, key: string) => (await rows(db, "select status, attempts, last_error, provider_id from public.email_outbox where dedupe_key = $1", [key]))[0];

/** A fake Resend: remembers what it was asked to send; the same idempotency key is the same email. */
function fakeResend() {
  const state = { requests: [] as any[], delivered: new Map<string, any>(), failNext: [] as number[] };
  return {
    state,
    send: async (message: any, idempotencyKey: string) => {
      state.requests.push({ message, idempotencyKey });
      const fail = state.failNext.shift();
      if (fail !== undefined && fail !== 200) return { ok: false, status: fail, id: null, error: fail === 0 ? "timeout" : `status ${fail}` };
      if (!state.delivered.has(idempotencyKey)) state.delivered.set(idempotencyKey, { id: `re_${state.delivered.size + 1}`, message });
      return { ok: true, status: 200, id: state.delivered.get(idempotencyKey).id, error: null };
    },
  };
}
function depsFor(db: PGlite, resend: ReturnType<typeof fakeResend>, over: any = {}) {
  return {
    claim: async (limit: number) => rows(db, "select * from public.claim_emails($1)", [limit]),
    finish: async (id: any, result: string, providerId: string | null, error: string | null) => one(db, "select public.finish_email($1, $2, $3, $4)", [id, result, providerId, error]),
    profileOf: async (id: string) => (await rows(db, "select id, email, email_updates, welcome_email_sent, credit_balance, plan_code from public.profiles where id = $1", [id]))[0] ?? null,
    markWelcomeSent: async (id: string) => { await db.query("update public.profiles set welcome_email_sent = true where id = $1", [id]); },
    unsubscribeLinks: (id: string) => unsubscribeLinks(id, { secret: "test-secret", supabaseUrl: "https://proj.supabase.co" }),
    send: resend.send,
    pause: async () => {},
    ...over,
  };
}
const quiet = async <T>(fn: () => Promise<T>): Promise<T> => {
  const keep = { error: console.error }; console.error = () => {};
  try { return await fn(); } finally { console.error = keep.error; }
};

// ============================================================
console.log("\n1. Enqueue: one row per key");
{
  const db = await freshDb();
  await addProfile(db, U(1));
  await db.query("delete from public.email_outbox"); // the welcome row the trigger just made
  check("first call queues the email → true", await enqueue(db, "pack:cs_1", "pack_confirmation", U(1), { credits: 300 }), true);
  check("the same key again → false, still one row", [await enqueue(db, "pack:cs_1", "pack_confirmation", U(1), { credits: 300 }), await one(db, "select count(*)::int from public.email_outbox")], [false, 1]);
  let err = "";
  try { await enqueue(db, "", "welcome", U(1)); } catch (e) { err = String((e as Error).message); }
  check("no key → refused", /dedupe_key and template are required/.test(err), true);
  check("the row waits as pending, nothing is sent by enqueueing", (await status(db, "pack:cs_1")), { status: "pending", attempts: 0, last_error: null, provider_id: null });
  await db.close();
}

console.log("\n2. Welcome: queued for every new profile, and never in the way of a signup");
{
  const db = await freshDb();
  await addProfile(db, U(1));
  check("a new profile queues welcome:<user>", await rows(db, "select dedupe_key, template, category, user_id::text from public.email_outbox"), [{ dedupe_key: `welcome:${U(1)}`, template: "welcome", category: "transactional", user_id: U(1) }]);
  await db.exec("alter table public.email_outbox rename to email_outbox_gone;");
  let err = "";
  try { await quiet(() => addProfile(db, U(2))); } catch (e) { err = String((e as Error).message); }
  check("outbox broken: the profile is still created", [err, await one(db, "select count(*)::int from public.profiles")], ["", 2]);
  await db.close();
}

console.log("\n3. A sender run");
{
  const db = await freshDb();
  const resend = fakeResend();
  await addProfile(db, U(1), { email: "new@example.com" });
  const first = await processOutbox(depsFor(db, resend));
  check("claims the welcome and sends it", first, { claimed: 1, sent: 1, retry: 0, failed: 0, skipped: 0, canceled: 0 });
  const req = resend.state.requests[0];
  check("from hello@, reply-to support, to the profile's address", [req.message.from, req.message.reply_to, req.message.to], [SENDERS.transactional, REPLY_TO, ["new@example.com"]]);
  check("transactional mail carries no unsubscribe header", req.message.headers, undefined);
  check("Resend gets the row's id as idempotency key", /^outbox-\d+$/.test(req.idempotencyKey), true);
  check("the row is the log: sent, one attempt, Resend's id", await status(db, `welcome:${U(1)}`), { status: "sent", attempts: 1, last_error: null, provider_id: "re_1" });
  check("the profile is marked welcomed", await one(db, "select welcome_email_sent from public.profiles where id = $1", [U(1)]), true);
  check("a second run finds nothing", await processOutbox(depsFor(db, resend)), { claimed: 0, sent: 0, retry: 0, failed: 0, skipped: 0, canceled: 0 });
  check("one email in total", resend.state.delivered.size, 1);

  await addProfile(db, U(2), { welcomed: true });           // welcomed by the old signup endpoint
  await addProfile(db, U(3), { email: null });               // no address
  await enqueue(db, "pack:gone", "pack_confirmation", U(99), { credits: 300 }); // account deleted since
  check("already welcomed → skipped; no address → canceled; account gone → canceled", await processOutbox(depsFor(db, resend)), { claimed: 3, sent: 0, retry: 0, failed: 0, skipped: 1, canceled: 2 });
  check("still one email in total", resend.state.delivered.size, 1);

  for (let i = 10; i < 35; i++) await enqueue(db, `pack:many_${i}`, "pack_confirmation", U(1), { credits: 300 });
  check("25 due, a run takes 10", (await processOutbox(depsFor(db, resend), { limit: 10 })).claimed, 10);
  await db.close();
}

console.log("\n4. The plan and pack emails");
{
  const db = await freshDb();
  const resend = fakeResend();
  await addProfile(db, U(1), { plan: "pro", balance: 1900, welcomed: true });
  await db.query("delete from public.email_outbox");
  await enqueue(db, "plan_welcome:sub_1", "plan_welcome", U(1), { plan: "pro", credits: 1600, interval: "monthly", period_end: "2026-11-04T10:00:00Z" });
  await enqueue(db, "pack:cs_1", "pack_confirmation", U(1), { credits: 300 });
  await enqueue(db, "plan_ended:sub_1", "plan_ended", U(1), { plan: "pro", reason: "canceled" });
  check("all three sent", (await processOutbox(depsFor(db, resend))).sent, 3);
  const bySubject = Object.fromEntries(resend.state.requests.map((r) => [r.message.subject, r.message]));
  check("subjects", Object.keys(bySubject).sort(), ["300 credits added to your Zyvo account", "You're now a Zyvo partner: Pro is active", "Your Zyvo plan has ended"]);
  const welcome = bySubject["You're now a Zyvo partner: Pro is active"];
  check("plan welcome: plan, credits, renewal date, billing link", [Boolean(welcome), /1,600 credits are in your account now/.test(welcome?.text), /renews on 4 Nov 2026/.test(welcome?.text), /settings\?tab=billing/.test(welcome?.html), /V2 and V3/.test(welcome?.text)], [true, true, true, true, true]);
  const pack = bySubject["300 credits added to your Zyvo account"];
  check("pack confirmation: credits and the balance at send time", [Boolean(pack), /300 credits were added/.test(pack?.text), /Your balance is now 1,900 credits/.test(pack?.text)], [true, true, true]);
  const ended = bySubject["Your Zyvo plan has ended"];
  check("plan ended: says so, keeps credits, links to the plans", [Boolean(ended), /Your Pro plan has ended\./.test(ended?.text), /1,900 credits on your account stay yours/.test(ended?.text), /\/pricing/.test(ended?.html)], [true, true, true, true]);
  await db.close();
}

console.log("\n5. Resend is down: retries with growing pauses, then a final failure");
{
  const db = await freshDb();
  const resend = fakeResend();
  await addProfile(db, U(1), { welcomed: true });
  await db.query("delete from public.email_outbox");
  await enqueue(db, "pack:cs_1", "pack_confirmation", U(1), { credits: 300 });
  const waits: string[] = [];
  let last: any;
  for (let attempt = 1; attempt <= 6; attempt++) {
    resend.state.failNext.push(503);
    last = await quiet(() => processOutbox(depsFor(db, resend)));
    const r = (await rows(db, "select status, attempts, round(extract(epoch from (next_attempt_at - now())) / 60)::int as wait_min, last_error from public.email_outbox"))[0];
    if (r.status === "pending") waits.push(`${r.wait_min}m`);
    check(`attempt ${attempt} fails → ${attempt < 6 ? "pending again" : "failed for good"}`, [r.status, r.attempts, /resend 503/.test(r.last_error)], [attempt < 6 ? "pending" : "failed", attempt, true]);
    await db.query("update public.email_outbox set next_attempt_at = now() where status = 'pending'"); // time passes
  }
  check("the pauses: 1 min, 5 min, 30 min, 2 h, 12 h", waits, ["1m", "5m", "30m", "120m", "720m"]);
  check("the last run reports it as failed", last, { claimed: 1, sent: 0, retry: 0, failed: 1, skipped: 0, canceled: 0 });
  check("a failed row is not claimed again", (await processOutbox(depsFor(db, resend))).claimed, 0);

  await enqueue(db, "pack:cs_2", "pack_confirmation", U(1), { credits: 500 });
  resend.state.failNext.push(0, 429);
  await processOutbox(depsFor(db, resend));
  await db.query("update public.email_outbox set next_attempt_at = now() where status = 'pending'");
  await processOutbox(depsFor(db, resend));
  await db.query("update public.email_outbox set next_attempt_at = now() where status = 'pending'");
  check("no answer, then rate limited, then fine: sent on the third attempt, one email", [(await processOutbox(depsFor(db, resend))).sent, (await status(db, "pack:cs_2")).attempts, resend.state.delivered.size], [1, 3, 1]);

  await enqueue(db, "pack:cs_3", "pack_confirmation", U(1), { credits: 500 });
  resend.state.failNext.push(422);
  check("Resend refuses the email itself (422): failed at once, no retries", [(await processOutbox(depsFor(db, resend))).failed, (await status(db, "pack:cs_3")).status], [1, "failed"]);
  await enqueue(db, "weird:1", "no_such_template", U(1));
  check("an unknown template: failed, nothing sent", [(await processOutbox(depsFor(db, resend))).failed, (await status(db, "weird:1")).last_error], [1, "render: unknown email template: no_such_template"]);
  await db.close();
}

console.log("\n6. The run dies after Resend accepted the email: no second email");
{
  const db = await freshDb();
  const resend = fakeResend();
  await addProfile(db, U(1), { welcomed: true });
  await db.query("delete from public.email_outbox");
  await enqueue(db, "pack:cs_1", "pack_confirmation", U(1), { credits: 300 });
  let broke = false;
  const dying = depsFor(db, resend, { finish: async () => { broke = true; throw new Error("connection lost"); } });
  await quiet(() => processOutbox(dying));
  check("sent, but the result could not be recorded: the row is still 'sending'", [broke, (await status(db, "pack:cs_1")).status, resend.state.delivered.size], [true, "sending", 1]);
  check("it is not picked up again right away", (await processOutbox(depsFor(db, resend))).claimed, 0);
  await db.query("update public.email_outbox set locked_at = now() - interval '11 minutes'");
  check("after 10 minutes it is claimed again and recorded as sent", [(await processOutbox(depsFor(db, resend))).sent, (await status(db, "pack:cs_1")).status], [1, "sent"]);
  check("Resend saw the same idempotency key twice: ONE email", [resend.state.requests.length, new Set(resend.state.requests.map((r) => r.idempotencyKey)).size, resend.state.delivered.size], [2, 1, 1]);
  await db.close();
}

console.log("\n7. Marketing mail only with consent");
{
  const db = await freshDb();
  const resend = fakeResend();
  await addProfile(db, U(1), { updates: true, welcomed: true });
  await addProfile(db, U(2), { updates: false, welcomed: true });
  await addProfile(db, U(3), { updates: null, welcomed: true });
  await addProfile(db, U(4), { updates: true, welcomed: true });
  await db.query("delete from public.email_outbox");
  // No marketing template exists yet; the welcome layout stands in for one here.
  for (const n of [1, 2, 3, 4]) await enqueue(db, `news:${n}`, "welcome", U(n), {}, "marketing");
  await db.query("update public.profiles set welcome_email_sent = false");
  await db.query("update public.profiles set email_updates = false where id = $1", [U(4)]); // unsubscribed after it was queued
  check("yes → sent; no, no answer, and unsubscribed since → skipped", await processOutbox(depsFor(db, resend)), { claimed: 4, sent: 1, retry: 0, failed: 0, skipped: 3, canceled: 0 });
  const m = resend.state.requests[0].message;
  check("from the marketing domain, with one-click unsubscribe headers", [m.from, /^<https:\/\/proj\.supabase\.co\/functions\/v1\/email-unsubscribe\?u=/.test(m.headers["List-Unsubscribe"]), m.headers["List-Unsubscribe-Post"]], [SENDERS.marketing, true, "List-Unsubscribe=One-Click"]);
  check("the skipped rows say why", (await status(db, "news:3")).last_error, "no marketing consent");
  await db.close();
}

console.log("\n8. The cron trigger for the sender");
{
  const db = await freshDb();
  check("nothing due → no call to the function at all", [await one(db, "select private.trigger_email_sender()"), await one(db, "select count(*)::int from net.calls")], [null, 0]);
  await addProfile(db, U(1));
  let err = "";
  try { await db.query("select private.trigger_email_sender()"); } catch (e) { err = String((e as Error).message); }
  check("something due but no Vault secrets → a clear error (the alert will show it)", err, "EMAIL_SENDER_VAULT_SECRETS_MISSING");
  await db.exec("insert into vault.decrypted_secrets (name, decrypted_secret) values ('email_sender_url', 'https://proj.supabase.co/functions/v1/email-sender'), ('email_sender_secret', 's3cret');");
  await db.query("select private.trigger_email_sender()");
  check("with the secrets: one POST to email-sender with the secret header", await rows(db, "select url, headers->>'x-email-sender-secret' as secret from net.calls"), [{ url: "https://proj.supabase.co/functions/v1/email-sender", secret: "s3cret" }]);
  await db.close();
}

console.log("\n9. The daily alert");
{
  const db = await freshDb();
  check("nothing wrong → empty report, no email", [await one(db, "select private.cron_failure_report()"), await one(db, "select private.send_cron_failure_alert()"), await one(db, "select count(*)::int from net.calls")], [[], null, 0]);
  await db.exec(`
    insert into cron.job (jobid, jobname) values (2, 'annual-monthly-credit-topup'), (1, 'delete_old_generated_images');
    insert into cron.job_run_details (jobid, status, return_message) values (2, 'failed', 'ERROR: invalid input syntax for type uuid: "747"'), (2, 'succeeded', '1 row'), (1, 'failed', 'violates foreign key constraint');
    insert into cron.job_run_details (jobid, status, return_message, start_time) values (1, 'failed', 'old news', now() - interval '3 days');
    insert into net._http_response (status_code, content) values (200, 'ok'), (401, 'Unauthorized'), (500, 'boom');
    insert into net._http_response (status_code, error_msg) values (null, 'timeout');
    insert into public.annual_topup_failures (user_id, external_id, error) values ('${U(7)}', 'annual_x_2026_10', 'simulated');
  `);
  await addProfile(db, U(1), { welcomed: true });
  await db.query("delete from public.email_outbox");
  await enqueue(db, "pack:bad", "pack_confirmation", U(1), {});
  await processOutbox(depsFor(db, fakeResend()));
  const report = (await one(db, "select private.cron_failure_report()")) as any[];
  check("the report lists failed cron runs, non-2xx function calls, top-up failures and failed emails; not successes, not old runs",
    report.map((i) => `${i.source}:${i.name}:${i.count}`).sort(),
    ["cron:annual-monthly-credit-topup:1", "cron:delete_old_generated_images:1", "email:pack_confirmation:1", "http:401:1", "http:500:1", "http:no response:1", `topup:${U(7)}:1`]);
  let err = "";
  try { await db.query("select private.send_cron_failure_alert()"); } catch (e) { err = String((e as Error).message); }
  check("no Vault secrets yet → a clear error", err, "CRON_ALERT_VAULT_SECRETS_MISSING");
  await db.exec("insert into vault.decrypted_secrets (name, decrypted_secret) values ('resend_api_key', 're_test'), ('alert_email', 'owner@example.com');");
  await db.query("select private.send_cron_failure_alert()");
  const call = (await rows(db, "select url, headers->>'authorization' as auth, body->>'to' as to_email, body->>'from' as from_email, body->>'subject' as subject, body->>'text' as text from net.calls"))[0];
  check("one email straight to Resend, to the alert address", [call.url, call.auth, call.to_email, call.from_email, call.subject], ["https://api.resend.com/emails", "Bearer re_test", "owner@example.com", "Zyvo Alerts <hello@tryzyvo.com>", "Zyvo: 7 scheduled job problem(s) in the last 24 hours"]);
  check("it names the job and the error", [/\[cron\] annual-monthly-credit-topup x1: ERROR: invalid input syntax for type uuid/.test(call.text), /\[http\] 401 x1: Unauthorized/.test(call.text)], [true, true]);
  await db.close();
}

console.log(failed ? `\n${failed} CHECK(S) FAILED` : "\nall checks passed");
Deno.exit(failed ? 1 : 0);
