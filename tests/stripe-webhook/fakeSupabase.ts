// In-memory stand-in for supabase-js, just enough for stripe-webhook/index.ts.
// deno-lint-ignore-file no-explicit-any
export const db: Record<string, any[]> = { profiles: [], credit_grants: [], billing_events_processed: [] };
/** Return an error message to make the matching call fail. */
export const inject: { fail: ((call: { table?: string; op: string; payload?: any }) => string | null) | null } = { fail: null };
const UNIQUE: Record<string, string> = { credit_grants: "external_id", billing_events_processed: "event_id" };

class Query {
  op = "select"; payload: any; filters: [string, any][] = []; single = false; max = Infinity;
  constructor(private table: string) {}
  select() { return this; }
  eq(col: string, val: any) { this.filters.push([col, val]); return this; }
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
    const hit = rows.filter((r) => this.filters.every(([c, v]) => r[c] === v)).slice(0, this.max);
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
