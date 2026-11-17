// The affiliate program end to end, offline and free: the REAL affiliate-api logic (_shared/affiliate/api.js)
// on the REAL migration, in an in-memory Postgres (PGlite), with a small stand-in for supabase-js.
// Walks: join → code → a new user signs up with the code (5 credits) → first payment → pending → 30 days →
// available → admin marks paid; plus refund reversal, self-referral, a flagged referral, credit payouts.
//
// PGlite is not a project dependency. Once: npm i --prefix <somewhere> @electric-sql/pglite@0.2.17
// Run:  PGLITE=<somewhere>/node_modules/@electric-sql/pglite/dist/index.js node scripts/affiliate/e2e.mjs
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { createAffiliateHandler } from "../../supabase/functions/_shared/affiliate/api.js";
import { AFFILIATE } from "../../supabase/functions/_shared/affiliate/config.js";

const { PGlite } = await import(pathToFileURL(process.env.PGLITE ?? "").href);
const pg = new PGlite();
await pg.exec(`
  create role anon; create role authenticated; create role service_role;
  create schema auth; create table auth.users (id uuid primary key, email text);
  create table public.profiles (id uuid primary key references auth.users(id), plan_code text default 'free', credit_balance int default 0, created_at timestamptz default now());
  create table public.credit_grants (id serial, user_id uuid, reason text, amount int, external_id text unique);
  create or replace function public.grant_credits_once(p_user_id uuid, p_amount integer, p_reason text, p_external_id text) returns boolean language plpgsql as $$
  begin
    begin insert into credit_grants (user_id, reason, amount, external_id) values (p_user_id, p_reason, p_amount, p_external_id);
    exception when unique_violation then return false; end;
    update profiles set credit_balance = credit_balance + p_amount where id = p_user_id;
    return true;
  end $$;`);
for (const m of ["20261217100000_affiliate_program.sql", "20261217110000_affiliate_onboarding_followup.sql"]) {
  await pg.exec(readFileSync(new URL(`../../supabase/migrations/${m}`, import.meta.url), "utf8"));
}

/* ---- a stand-in for the few supabase-js calls api.js makes ---- */
const users = new Map(); // token → user
class Q {
  constructor(t) { this.t = t; this.w = []; this.p = []; this.op = "select"; this.cols = "*"; this.ord = ""; this.lim = ""; this.one = false; }
  add(sql, v) { this.p.push(v); this.w.push(sql.replace("?", `$${this.p.length}`)); return this; }
  select(c = "*") { if (this.op === "select") this.cols = c; return this; }
  eq(c, v) { return v === null ? (this.w.push(`${c} is null`), this) : this.add(`${c} = ?`, v); }
  neq(c, v) { return this.add(`${c} <> ?`, v); }
  gte(c, v) { return this.add(`${c} >= ?`, v); }
  in(c, vs) { return this.add(`${c} = any(?)`, vs); }
  order(c, o = {}) { this.ord = ` order by ${c} ${o.ascending === false ? "desc" : "asc"}`; return this; }
  limit(n) { this.lim = ` limit ${n}`; return this; }
  maybeSingle() { this.one = true; return this; }
  insert(row) { this.op = "insert"; this.row = row; return this; }
  update(patch) { this.op = "update"; this.patch = patch; return this; }
  async run() {
    try {
      if (this.op === "insert") {
        const ks = Object.keys(this.row);
        await pg.query(`insert into ${this.t} (${ks.join(",")}) values (${ks.map((_, i) => `$${i + 1}`).join(",")})`, ks.map((k) => this.row[k]));
        return { data: null, error: null };
      }
      const where = this.w.length ? ` where ${this.w.join(" and ")}` : "";
      if (this.op === "update") {
        const ks = Object.keys(this.patch);
        const off = this.p.length;
        const set = ks.map((k, i) => `${k} = $${off + i + 1}`).join(", ");
        await pg.query(`update ${this.t} set ${set}${where}`, [...this.p, ...ks.map((k) => this.patch[k])]);
        return { data: null, error: null };
      }
      const rows = (await pg.query(`select ${this.cols} from ${this.t}${where}${this.ord}${this.lim}`, this.p)).rows;
      return { data: this.one ? rows[0] ?? null : rows, error: null };
    } catch (e) { return { data: null, error: { message: e.message } }; }
  }
  then(a, b) { return this.run().then(a, b); }
}
const sb = {
  from: (t) => new Q(t),
  rpc: async (name, args) => {
    const ks = Object.keys(args);
    try {
      const res = await pg.query(`select * from public.${name}(${ks.map((k, i) => `${k} => $${i + 1}`).join(", ")})`, ks.map((k) => args[k]));
      const scalar = res.fields.length === 1 && res.fields[0].name === name;
      return { data: scalar ? res.rows[0]?.[name] : res.rows, error: null };
    } catch (e) { return { data: null, error: { message: e.message } }; }
  },
  auth: { admin: {
    getUserById: async (id) => ({ data: { user: (await pg.query("select id, email from auth.users where id = $1", [id])).rows[0] ?? null } }),
    listUsers: async () => ({ data: { users: (await pg.query("select id, email from auth.users")).rows }, error: null }),
  } },
};
const handle = createAffiliateHandler({
  sb, salt: "test", adminEmails: ["owner@zyvo.test"], cors: () => ({ "content-type": "application/json" }),
  getUser: async (token) => ({ data: { user: users.get(token) ?? null }, error: null }),
});

let i = 0;
async function newUser(email, fullName, extra = "") {
  const id = `00000000-0000-4000-8000-${String(++i).padStart(12, "0")}`;
  await pg.query("insert into auth.users values ($1, $2)", [id, email]);
  await pg.query(`insert into profiles (id) values ($1)`, [id]);
  if (extra) await pg.query(extra, [id]);
  const user = { id, email, email_confirmed_at: "2026-01-01", user_metadata: { full_name: fullName } };
  users.set(`tok-${id}`, user);
  return user;
}
async function call(user, action, args = {}, ip = "1.1.1.1") {
  const headers = { "content-type": "application/json", "x-forwarded-for": ip };
  if (user) headers.Authorization = `Bearer tok-${user.id}`;
  const res = await handle(new Request("http://local/affiliate-api", { method: "POST", headers, body: JSON.stringify({ action, ...args }) }));
  const body = await res.json();
  if (!body.ok && res.status >= 500) throw new Error(`${action}: ${body.message}`);
  return body.data ?? body;
}
const balance = async (u) => (await pg.query("select credit_balance from profiles where id = $1", [u.id])).rows[0].credit_balance;
let failed = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? "  ok " : "FAIL "} ${name}${ok ? "" : `  got ${JSON.stringify(got)} want ${JSON.stringify(want)}`}`);
};
const pay = (user, id, cents, intent = null) => sb.rpc("affiliate_record_payment", { p_user_id: user.id, p_payment_id: id, p_payment_intent: intent, p_amount_cents: cents,
  p_currency: "eur", p_plan: "pro", p_paid_at: new Date().toISOString(), p_hold_days: AFFILIATE.holdDays, p_credit_value_cents: 2, p_is_test: false });

/* ---- the walk ---- */
const owner = await newUser("owner@zyvo.test", "Owner");
const maya = await newUser("maya.k@example.com", "Maya Korhonen");

console.log("1. Join");
const before = await call(maya, "me");
check("not joined yet", before.joined, false);
const me = await call(maya, "join", {}, "9.9.9.9");
check("joined with a code from the name", [me.joined, me.affiliate.code, me.affiliate.displayName], [true, "MAYAKORHONEN", "Maya"]);
check("link", me.affiliate.link, "https://tryzyvo.com/?ref=MAYAKORHONEN");
check("empty stats", [me.stats.clicks, me.stats.signups, me.stats.buyers, me.stats.earnedCents], [0, 0, 0, 0]);
check("edit the code once", (await call(maya, "setCode", { code: "maya" })).ok, true);
check("a second edit is refused", (await call(maya, "setCode", { code: "maya2" })).problem, "edit_used");
check("reserved word refused", (await call(owner, "join").then(() => call(owner, "setCode", { code: "zyvo" }))).problem, "reserved");

console.log("2. Link click (hashed IP), lookup");
check("click counted", (await call(null, "click", { code: "Maya", ua: "test" }, "5.5.5.5")).counted, true);
check("same visitor again within 30 min → not counted twice", (await call(null, "click", { code: "MAYA" }, "5.5.5.5")).counted, false);
check("no raw IP stored", (await pg.query("select ip_hash from referral_clicks")).rows.every((r) => r.ip_hash && !r.ip_hash.includes("5.5.5.5")), true);
check("lookup any case → display name", await call(null, "lookup", { code: "maya" }), { valid: true, code: "MAYA", displayName: "Maya" });
check("lookup unknown", (await call(null, "lookup", { code: "nobody1" })).valid, false);
check("own code in lookup → self", (await call(maya, "lookup", { code: "maya" })).reason, "self");

console.log("3. Self-referral, new user with the code");
check("self-referral blocked", (await call(maya, "claim", { code: "MAYA", source: "code" })).result, "self");
const buyer = await newUser("buyer@example.com", "Bob Buyer");
check("new user may claim", (await call(buyer, "claimStatus")).eligible, true);
const cl = await call(buyer, "claim", { code: "maya", source: "code" }, "7.7.7.7");
check("claimed, 5 credits", [cl.result, cl.displayName, cl.bonusCredits, await balance(buyer)], ["claimed", "Maya", 5, 5]);
check("can't switch creator later", (await call(buyer, "claim", { code: (await call(owner, "me")).affiliate.code })).result, "already_attributed");
check("claimStatus now names the creator", (await call(buyer, "claimStatus")).creator?.code, "MAYA");

console.log("4. First payment → pending → 30 days → available → paid");
await pay(buyer, "in_test_1", 3800, "pi_1");
let m = await call(maya, "me");
check("buyer counted, €7.60 pending, unlock date set", [m.stats.buyers, m.earnings.pendingCents, Boolean(m.earnings.nextUnlockAt)], [1, 760, true]);
check("activity has no personal data", JSON.stringify(m.activity).includes("buyer@example.com") || JSON.stringify(m.activity).includes("Bob"), false);
check("activity lines", m.activity.map((a) => `${a.kind}:${a.status ?? ""}`).sort(), ["buyer:pending", "signup:"]);
const affId = (await pg.query("select id from affiliates where code = 'MAYA'")).rows[0].id;
check("test tool: 30 days later", (await call(owner, "adminTestAge", { affiliateId: affId })).released, 1);
m = await call(maya, "me");
check("now available", [m.earnings.pendingCents, m.earnings.availableCents], [0, 760]);
check("payout settings: cash needs an email", (await call(maya, "setPayout", { type: "cash", method: "paypal", email: "nope" })).problem, "email");
check("payout settings saved", (await call(maya, "setPayout", { type: "cash", method: "wise", email: "maya.pay@example.com" })).ok, true);
let ov = await call(owner, "adminOverview");
check("below €25: not in the payout queue", ov.payoutQueue.length, 0);
check("admin table row", (({ code, signups, buyers, availableCents }) => ({ code, signups, buyers, availableCents }))(ov.affiliates.find((a) => a.code === "MAYA")), { code: "MAYA", signups: 1, buyers: 1, availableCents: 760 });
// two more buyers to pass €25
for (const k of [2, 3, 4]) {
  const u = await newUser(`b${k}@example.com`, `B ${k}`);
  await call(u, "claim", { code: "MAYA", source: "link" }, `8.8.8.${k}`);
  await pay(u, `in_test_${k}`, 3800);
}
await call(owner, "adminTestAge", { affiliateId: affId });
ov = await call(owner, "adminOverview");
check("€30.40 available → in the queue with the Wise email", ov.payoutQueue.map((q) => [q.code, q.amountCents, q.payoutMethod, q.payoutEmail]), [["MAYA", 3040, "wise", "maya.pay@example.com"]]);
const paid = await call(owner, "adminMarkPaid", { affiliateId: affId, reference: "WISE-1" });
check("marked paid", [paid.ok, paid.amount], [true, 3040]);
m = await call(maya, "me");
check("page: paid out €30.40, nothing available", [m.earnings.paidCents, m.earnings.availableCents], [3040, 0]);

console.log("5. Refund reversal");
const r1 = await newUser("refund@example.com", "R");
await call(r1, "claim", { code: "MAYA", source: "code" }, "6.6.6.6");
check("test payment from the admin page", (await call(owner, "adminTestPayment", { email: "refund@example.com", amountEur: 19, plan: "starter" })).result, "created");
check("test refund reverses it", (await call(owner, "adminTestRefund", { email: "refund@example.com" })).reversed, 1);
m = await call(maya, "me");
check("reversed: not counted as a buyer or as earnings", [m.stats.buyers, m.earnings.pendingCents], [4, 0]);

console.log("6. Flagged (same IP as the affiliate) and credits payout");
const twin = await newUser("twin@example.com", "Twin");
const fl = await call(twin, "claim", { code: "MAYA", source: "code" }, "9.9.9.9");
check("same IP as Maya → claimed but no bonus", [fl.result, fl.bonusCredits, await balance(twin)], ["claimed", 0, 0]);
ov = await call(owner, "adminOverview");
check("in the flagged list", ov.flagged.map((f) => [f.affiliateCode, f.reason, f.referredEmail]), [["MAYA", "same_ip_as_affiliate", "twin@example.com"]]);
check("reject", (await call(owner, "adminResolveFlag", { referralId: ov.flagged[0].id, approve: false })).result, "rejected");
check("rejected: no commission later", (await pay(twin, "in_twin", 3800)).data.result, "rejected");
check("a non-admin gets NOT_FOUND", (await call(maya, "adminOverview")).code, "NOT_FOUND");

check("switch to credits", (await call(maya, "setPayout", { type: "credits" })).ok, true);
const c1 = await newUser("c1@example.com", "C");
await call(c1, "claim", { code: "MAYA", source: "code" }, "4.4.4.4");
await pay(c1, "in_c1", 3800);
const mayaBefore = await balance(maya);
await call(owner, "adminTestAge", { affiliateId: affId });
check("credit commission added automatically: 40% of €38 = 760 credits", (await balance(maya)) - mayaBefore, 760);
m = await call(maya, "me");
check("paid credits shown", m.earnings.paidCredits, 760);

console.log("7. Old account can't be attributed; disabled affiliate");
const old = await newUser("old@example.com", "Old", "update profiles set created_at = now() - interval '40 days' where id = $1");
check("too old", (await call(old, "claim", { code: "MAYA" })).result, "too_old");
await call(owner, "adminUpdate", { affiliateId: affId, status: "disabled" });
check("disabled code doesn't validate", (await call(null, "lookup", { code: "MAYA" })).valid, false);
check("admin rate override", (await call(owner, "adminUpdate", { affiliateId: affId, status: "active", cashRate: 0.25 })).ok, true);
check("new since last visit", (await call(maya, "markSeen")).ok, true);

console.log("8. Survey follow-up: platform saved, same-IP credit cooldown, rate limit");
await call(owner, "adminUpdate", { affiliateId: affId, status: "active" });
const t1 = await newUser("tt1@example.com", "T1");
const p1 = await call(t1, "claim", { code: "MAYA", source: "code", platform: "tiktok" }, "3.3.3.3");
check("TikTok sign-up: claimed, 5 credits", [p1.result, p1.bonusCredits], ["claimed", 5]);
check("platform saved on the referral", (await pg.query("select platform from referrals where referred_user_id = $1", [t1.id])).rows[0].platform, "tiktok");
const t2 = await newUser("tt2@example.com", "T2");
const p2 = await call(t2, "claim", { code: "MAYA", source: "code", platform: "youtube" }, "3.3.3.3");
check("same IP within 7 days: still counts for the creator, no credits", [p2.result, p2.bonusCredits, p2.bonusSkipped, await balance(t2)], ["claimed", 0, "ip_recent", 0]);
await pg.query("update referrals set created_at = now() - interval '8 days' where referred_user_id = $1", [t1.id]);
const t3 = await newUser("tt3@example.com", "T3");
check("after 7 days the same IP may get credits again (another creator: a 3rd sign-up from one IP for MAYA is held for review)", (await call(t3, "claim", { code: (await call(owner, "me")).affiliate.code, source: "code", platform: "instagram" }, "3.3.3.3")).bonusCredits, 5);
check("a made-up platform: still claimed", (await call(await newUser("tt4@example.com", "T4"), "claim", { code: "MAYA", source: "code", platform: "myspace" }, "2.2.2.2")).result, "claimed");
check("...saved as no platform", (await pg.query("select platform from referrals r join auth.users u on u.id = r.referred_user_id where u.email = 'tt4@example.com'")).rows[0].platform, null);
ov = await call(owner, "adminOverview");
const pf = ov.affiliates.find((a) => a.code === "MAYA").platforms;
check("admin: where MAYA's sign-ups came from", [pf.tiktok, pf.youtube, pf.other > 0], [1, 1, true]);
const results = [];
for (let k = 0; k < 11; k++) results.push((await call(null, "lookup", { code: "MAYA" }, "10.0.0.1")).reason ?? "ok");
check("11th code check within a minute from one IP: rate limited", [results.slice(0, 10).every((r) => r === "ok"), results[10]], [true, "rate_limited"]);
check("another IP is not affected", (await call(null, "lookup", { code: "MAYA" }, "10.0.0.2")).valid, true);
const spam = await newUser("spam@example.com", "S");
for (let k = 0; k < 10; k++) await call(spam, "lookup", { code: "NOPE" + k }, "10.1.0." + k);
check("...and per account, whatever the IP", (await call(spam, "claim", { code: "MAYA", source: "code" }, "10.2.0.1")).result, "rate_limited");

console.log(failed ? `\n${failed} FAILED` : "\nall end-to-end checks passed");
process.exit(failed ? 1 : 0);
