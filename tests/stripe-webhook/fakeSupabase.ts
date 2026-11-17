// In-memory stand-in for supabase-js, just enough for stripe-webhook/index.ts.
// deno-lint-ignore-file no-explicit-any
export const db: Record<string, any[]> = { profiles: [], credit_grants: [], billing_events_processed: [], offer_redemptions: [], signup_bonuses: [], commissions: [], affiliate_calls: [], funnel_events: [], cutaway_free_previews: [] };
/** The affiliate functions (migration 20261217100000), modelled just enough: referred users, one commission each. missing: not installed. */
export const affiliateFake: { missing: boolean; referred: Set<string> } = { missing: false, referred: new Set() };
/** Return an error message to make the matching call fail. */
export const inject: { fail: ((call: { table?: string; op: string; payload?: any }) => string | null) | null } = { fail: null };
const UNIQUE: Record<string, string> = { credit_grants: "external_id", billing_events_processed: "event_id" };

class Query {
  op = "select"; payload: any; filters: [string, any][] = []; single = false; max = Infinity;
  constructor(private table: string) {}
  select() { return this; }
  eq(col: string, val: any) { this.filters.push([col, val]); return this; }
  is(col: string, val: any) { this.filters.push([col, val]); return this; }
  limit(n: number) { this.max = n; return this; }
  maybeSingle() { this.single = true; return this; }
  update(patch: any) { this.op = "update"; this.payload = patch; return this; }
  insert(row: any) { this.op = "insert"; this.payload = row; return this; }
  exec() {
    const msg = inject.fail?.({ table: this.table, op: this.op, payload: this.payload });
    if (msg) return { data: null, error: { message: msg } };
    const rows = db[this.table];
    if (this.op === "insert") {
      const u = UNIQUE[this.table];
      if (u && rows.some((r) => r[u] === this.payload[u])) return { data: null, error: { code: "23505", message: "duplicate key" } };
      rows.push({ ...this.payload });
      return { data: null, error: null };
    }
    const hit = rows.filter((r) => this.filters.every(([c, v]) => (r[c] ?? null) === v)).slice(0, this.max);
    if (this.op === "update") hit.forEach((r) => Object.assign(r, this.payload));
    const data = hit.map((r) => ({ ...r }));
    return { data: this.single ? data[0] ?? null : data, error: null };
  }
  then(ok: any, bad: any) { return Promise.resolve(this.exec()).then(ok, bad); }
}

export function createClient(..._args: any[]): any {
  return {
    from: (table: string) => new Query(table),
    rpc: (name: string, args: any) => {
      const msg = inject.fail?.({ op: `rpc:${name}`, payload: args });
      if (msg) return Promise.resolve({ data: null, error: { message: msg } });
      // grant_offer_bonus (migration 20261108400000): one row per account and offer, then the credits
      // through grant_credits_once with reason offer_bonus; a second call for the same account is false.
      if (name === "grant_offer_bonus") {
        if (db.offer_redemptions.some((r) => r.user_id === args.p_user_id && r.offer_id === args.p_offer_id)) return Promise.resolve({ data: false, error: null });
        const p = db.profiles.find((r) => r.id === args.p_user_id);
        if (!p) return Promise.resolve({ data: null, error: { message: `grant_offer_bonus: no profile ${args.p_user_id}` } });
        db.offer_redemptions.push({ user_id: args.p_user_id, offer_id: args.p_offer_id, invoice_id: args.p_invoice_id, credits: args.p_credits, paid_at: args.p_paid_at });
        const ext = `${args.p_offer_id}:${args.p_user_id}`;
        if (db.credit_grants.some((g) => g.external_id === ext)) return Promise.resolve({ data: false, error: null });
        db.credit_grants.push({ user_id: args.p_user_id, reason: "offer_bonus", amount: args.p_credits, external_id: ext });
        p.credit_balance = (p.credit_balance ?? 0) + args.p_credits;
        return Promise.resolve({ data: true, error: null });
      }
      if (name.startsWith("affiliate_")) {
        if (affiliateFake.missing) return Promise.resolve({ data: null, error: { code: "PGRST202", message: `Could not find the function public.${name}` } });
        db.affiliate_calls.push({ name, args });
        const ok = (data: any) => Promise.resolve({ data, error: null });
        if (name === "affiliate_record_payment") {
          if (!affiliateFake.referred.has(args.p_user_id)) return ok({ result: "not_referred" });
          if (db.commissions.some((c) => c.payment_id === args.p_payment_id)) return ok({ result: "duplicate" });
          if (db.commissions.some((c) => c.user_id === args.p_user_id)) return ok({ result: "not_first" });
          db.commissions.push({ user_id: args.p_user_id, payment_id: args.p_payment_id, payment_intent: args.p_payment_intent, amount: args.p_amount_cents, plan: args.p_plan, hold: args.p_hold_days, status: "pending" });
          return ok({ result: "created" });
        }
        if (name === "affiliate_reverse_payment") {
          const hit = db.commissions.filter((c) => c.status === "pending" && ((args.p_payment_id && c.payment_id === args.p_payment_id) || (args.p_payment_intent && c.payment_intent === args.p_payment_intent)));
          hit.forEach((c) => { c.status = "reversed"; });
          return ok({ reversed: hit.length, already_paid: 0 });
        }
        return ok(null);
      }
      if (name !== "grant_credits_once") return Promise.resolve({ data: null, error: { message: `no function ${name}` } });
      // Same contract as the SQL function: ledger row + balance together, or neither.
      if (db.credit_grants.some((g) => g.external_id === args.p_external_id)) return Promise.resolve({ data: false, error: null });
      const p = db.profiles.find((r) => r.id === args.p_user_id);
      if (!p) return Promise.resolve({ data: null, error: { message: `grant_credits_once: no profile ${args.p_user_id}` } });
      db.credit_grants.push({ user_id: args.p_user_id, reason: args.p_reason, amount: args.p_amount, external_id: args.p_external_id });
      p.credit_balance = (p.credit_balance ?? 0) + args.p_amount;
      return Promise.resolve({ data: true, error: null });
    },
  };
}
