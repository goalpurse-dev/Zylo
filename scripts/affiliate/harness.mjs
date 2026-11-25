// Offline test bed for the affiliate + rewards APIs: an in-memory Postgres (PGlite) with stub auth/profiles/credits/
// prices, every affiliate + rewards migration, and a small stand-in for the supabase-js calls the APIs make.
// PGlite is not a project dependency: PGLITE=<path to @electric-sql/pglite/dist/index.js>.
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const MIGRATIONS = [
  "20261217100000_affiliate_program.sql", "20261217110000_affiliate_onboarding_followup.sql", "20261217120000_affiliate_handles.sql",
  "20261218100000_rewards.sql",
];

export async function makeHarness() {
  const { PGlite } = await import(pathToFileURL(process.env.PGLITE ?? "").href);
  const pg = new PGlite();
  await pg.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth; create table auth.users (id uuid primary key, email text);
    create table public.profiles (id uuid primary key references auth.users(id), plan_code text default 'free', credit_balance int default 0, created_at timestamptz default now());
    create table public.credit_grants (id serial, user_id uuid, reason text, amount int, external_id text unique);
    create table public.tool_prices (tool_key text primary key, flat_credits int);
    insert into public.tool_prices values ('blocky-worlds:video-90', 313);
    create or replace function public.grant_credits_once(p_user_id uuid, p_amount integer, p_reason text, p_external_id text) returns boolean language plpgsql as $$
    begin
      begin insert into credit_grants (user_id, reason, amount, external_id) values (p_user_id, p_reason, p_amount, p_external_id);
      exception when unique_violation then return false; end;
      update profiles set credit_balance = credit_balance + p_amount where id = p_user_id;
      return true;
    end $$;`);
  for (const m of MIGRATIONS) await pg.exec(readFileSync(new URL(`../../supabase/migrations/${m}`, import.meta.url), "utf8"));

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
          await pg.query(`update ${this.t} set ${ks.map((k, i) => `${k} = $${off + i + 1}`).join(", ")}${where}`, [...this.p, ...ks.map((k) => (typeof this.patch[k] === "object" && this.patch[k] !== null ? JSON.stringify(this.patch[k]) : this.patch[k]))]);
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
        const res = await pg.query(`select * from public.${name}(${ks.map((k, i) => `${k} => $${i + 1}`).join(", ")})`, ks.map((k) => (Array.isArray(args[k]) && args[k].length && typeof args[k][0] === "object" ? JSON.stringify(args[k]) : args[k])));
        const scalar = res.fields.length === 1 && res.fields[0].name === name;
        return { data: scalar ? res.rows[0]?.[name] : res.rows, error: null };
      } catch (e) { return { data: null, error: { message: e.message } }; }
    },
    auth: { admin: {
      getUserById: async (id) => ({ data: { user: (await pg.query("select id, email from auth.users where id = $1", [id])).rows[0] ?? null } }),
      listUsers: async () => ({ data: { users: (await pg.query("select id, email from auth.users")).rows }, error: null }),
    } },
  };

  const users = new Map();
  let i = 0;
  async function newUser(email, fullName, { plan = "free", ageDays = 0 } = {}) {
    const id = `00000000-0000-4000-8000-${String(++i).padStart(12, "0")}`;
    await pg.query("insert into auth.users values ($1, $2)", [id, email]);
    await pg.query("insert into profiles (id, plan_code, created_at) values ($1, $2, now() - make_interval(days => $3))", [id, plan, ageDays]);
    const user = { id, email, email_confirmed_at: "2026-01-01", user_metadata: { full_name: fullName } };
    users.set(`tok-${id}`, user);
    return user;
  }
  const getUser = async (token) => ({ data: { user: users.get(token) ?? null }, error: null });
  const caller = (handle) => async (user, action, args = {}, ip = "1.1.1.1") => {
    const headers = { "content-type": "application/json", "x-forwarded-for": ip };
    if (user) headers.Authorization = `Bearer tok-${user.id}`;
    const res = await handle(new Request("http://local/api", { method: "POST", headers, body: JSON.stringify({ action, ...args }) }));
    const body = await res.json();
    if (!body.ok && res.status >= 500) throw new Error(`${action}: ${body.message}`);
    return body.data ?? body;
  };
  const balance = async (u) => (await pg.query("select credit_balance from profiles where id = $1", [u.id])).rows[0].credit_balance;
  let failed = 0;
  const check = (name, got, want) => {
    const ok = JSON.stringify(got) === JSON.stringify(want);
    if (!ok) failed++;
    console.log(`${ok ? "  ok " : "FAIL "} ${name}${ok ? "" : `  got ${JSON.stringify(got)} want ${JSON.stringify(want)}`}`);
  };
  return { pg, sb, newUser, getUser, caller, balance, check, failed: () => failed };
}
