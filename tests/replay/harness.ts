// deno-lint-ignore-file no-explicit-any
// Offline replay harness for the Script Engine (advance-long-form-script).
// Runs the REAL stage code (runScriptStage — the same dispatch production
// uses) against an in-memory Supabase fake and a cassette player that
// answers every model/search call from recorded or handwritten responses.
// Zero API spend.

import { installCassettePlayer, type CassetteEntry } from "../../supabase/functions/_shared/stickman/cassette.ts";

export const FAKE_SUPABASE_HOST = "replay.supabase.test";

/* ============================ In-memory Supabase ============================ */

type Row = Record<string, any>;

class Query {
  private filters: ((r: Row) => boolean)[] = [];
  private op: "select" | "update" | "insert" | "upsert" = "select";
  private payload: any = null;
  private singleMode: "none" | "single" | "maybe" = "none";
  private limitN: number | null = null;
  private orderBy: { col: string; asc: boolean } | null = null;
  private returnRows = false;

  constructor(private db: FakeSupabase, private table: string) {}

  select(_cols?: string, _opts?: any) {
    if (this.op !== "select") this.returnRows = true;
    return this;
  }
  update(payload: any) {
    this.op = "update";
    this.payload = payload;
    return this;
  }
  insert(payload: any) {
    this.op = "insert";
    this.payload = payload;
    return this;
  }
  upsert(payload: any) {
    this.op = "upsert";
    this.payload = payload;
    return this;
  }
  eq(col: string, val: any) {
    this.filters.push((r) => r[col] === val);
    return this;
  }
  neq(col: string, val: any) {
    this.filters.push((r) => r[col] !== val);
    return this;
  }
  in(col: string, vals: any[]) {
    this.filters.push((r) => vals.includes(r[col]));
    return this;
  }
  is(col: string, val: any) {
    this.filters.push((r) => (r[col] ?? null) === val);
    return this;
  }
  order(col: string, opts: { ascending?: boolean } = {}) {
    this.orderBy = { col, asc: opts.ascending !== false };
    return this;
  }
  limit(n: number) {
    this.limitN = n;
    return this;
  }
  maybeSingle() {
    this.singleMode = "maybe";
    return this;
  }
  single() {
    this.singleMode = "single";
    return this;
  }

  private execute(): { data: any; error: any; count?: number } {
    // A killed process: every write after the kill is silently lost.
    if (this.db.frozen && this.op !== "select") return { data: null, error: null };
    const rows = this.db.table(this.table);
    if (this.op === "insert" || this.op === "upsert") {
      const items = (Array.isArray(this.payload) ? this.payload : [this.payload]).map((p: any) => ({ id: p.id ?? crypto.randomUUID(), ...structuredClone(p) }));
      for (const item of items) {
        const existing = this.op === "upsert" ? rows.findIndex((r) => r.id === item.id) : -1;
        if (existing >= 0) rows[existing] = { ...rows[existing], ...item };
        else rows.push(item);
      }
      const data = this.singleMode !== "none" ? structuredClone(items[0]) : structuredClone(items);
      return { data: this.returnRows || this.singleMode !== "none" ? data : null, error: null };
    }
    let matched = rows.filter((r) => this.filters.every((f) => f(r)));
    if (this.op === "update") {
      for (const r of matched) Object.assign(r, structuredClone(this.payload));
      this.db.updates.push({ table: this.table, payload: structuredClone(this.payload), ids: matched.map((r) => r.id) });
    }
    if (this.orderBy) {
      const { col, asc } = this.orderBy;
      matched = [...matched].sort((a, b) => (a[col] > b[col] ? 1 : a[col] < b[col] ? -1 : 0) * (asc ? 1 : -1));
    }
    if (this.limitN != null) matched = matched.slice(0, this.limitN);
    const out = structuredClone(matched);
    if (this.singleMode === "maybe") return { data: out[0] ?? null, error: null };
    if (this.singleMode === "single") return out[0] ? { data: out[0], error: null } : { data: null, error: { message: "no rows" } };
    return { data: this.op === "update" && !this.returnRows ? null : out, error: null, count: out.length };
  }

  then(resolve: (v: any) => any, reject?: (e: any) => any) {
    try {
      return Promise.resolve(this.execute()).then(resolve, reject);
    } catch (e) {
      return reject ? Promise.resolve(reject(e)) : Promise.reject(e);
    }
  }
}

export class FakeSupabase {
  tables = new Map<string, Row[]>();
  frozen = false;
  updates: { table: string; payload: any; ids: string[] }[] = [];
  rpcCalls: { name: string; args: any }[] = [];
  uploads: { bucket: string; path: string }[] = [];

  table(name: string): Row[] {
    if (!this.tables.has(name)) this.tables.set(name, []);
    return this.tables.get(name)!;
  }
  from(name: string) {
    return new Query(this, name);
  }
  rpc(name: string, args: any) {
    this.rpcCalls.push({ name, args });
    return Promise.resolve({ data: null, error: null });
  }
  storage = {
    from: (bucket: string) => ({
      upload: (path: string) => {
        this.uploads.push({ bucket, path });
        return Promise.resolve({ data: { path }, error: null });
      },
    }),
  };
  get(table: string, id: string): Row {
    const r = this.table(table).find((x) => x.id === id);
    if (!r) throw new Error(`${table} ${id} not found`);
    return r;
  }
}

/* ============================ Engine loader ============================ */

let enginePromise: Promise<any> | null = null;

export function loadEngine(env: Record<string, string> = {}) {
  if (!enginePromise) {
    const base: Record<string, string> = {
      SCRIPT_ENGINE_OFFLINE_TEST: "true",
      SUPABASE_URL: `https://${FAKE_SUPABASE_HOST}`,
      SUPABASE_SERVICE_ROLE_KEY: "replay-service-key",
      OPENAI_API_KEY: "replay-openai-key",
      ANTHROPIC_API_KEY: "replay-anthropic-key",
      LONG_FORM_SCRIPT_ADVANCE_SECRET: "replay-secret",
      LONG_FORM_STICKMAN_DRAFT_ONLY_TEST: "false",
      LONG_FORM_SCRIPT_RECORD_CASSETTES: "false",
      ...env,
    };
    for (const [k, v] of Object.entries(base)) Deno.env.set(k, v);
    enginePromise = import("../../supabase/functions/advance-long-form-script/index.ts");
  }
  return enginePromise;
}

/* ============================ Seeding + driver ============================ */

export type Snapshot = {
  project: Row;
  storyPlanVersion: Row;
  researchVersion: Row;
  profile: Row;
};

export function seedDb(snapshot: Snapshot, scriptOverrides: Row = {}): { db: FakeSupabase; scriptId: string } {
  const db = new FakeSupabase();
  db.table("long_form_projects").push(structuredClone(snapshot.project));
  db.table("long_form_story_plan_versions").push(structuredClone(snapshot.storyPlanVersion));
  db.table("long_form_research_versions").push(structuredClone(snapshot.researchVersion));
  db.table("long_form_generation_profiles").push(structuredClone(snapshot.profile));
  const scriptId = crypto.randomUUID();
  db.table("long_form_script_versions").push({
    id: scriptId,
    project_id: snapshot.project.id,
    story_plan_version_id: snapshot.storyPlanVersion.id,
    research_version_id: snapshot.researchVersion.id,
    version: 1,
    status: "drafting",
    stage: "draft",
    stage_attempt: 0,
    worker_lock_until: null,
    script_document: null,
    critic_result: null,
    intermediate: {},
    meta: {},
    detail: null,
    ...scriptOverrides,
  });
  return { db, scriptId };
}

const CLAIMABLE = "drafting";

// Mirrors claim_long_form_script_stage_by_id: only status "drafting" rows are
// claimed, stage_attempt increments per claim, and 3 attempts is the ceiling.
export async function runPipeline(db: FakeSupabase, scriptId: string, maxSteps = 20) {
  const engine = await loadEngine();
  const stages: string[] = [];
  for (let step = 0; step < maxSteps; step++) {
    const row = db.get("long_form_script_versions", scriptId);
    if (row.status !== CLAIMABLE) break;
    if ((row.stage_attempt ?? 0) >= 3) {
      Object.assign(row, { status: "failed", last_error_code: "stage_attempts_exhausted_via_worker_disappearance" });
      break;
    }
    row.stage_attempt = (row.stage_attempt ?? 0) + 1;
    stages.push(row.stage);
    await engine.runScriptStage(db, structuredClone(row));
  }
  return { row: db.get("long_form_script_versions", scriptId), stages };
}

export function playCassette(entries: CassetteEntry[]) {
  return installCassettePlayer(entries, { ignoreHosts: [FAKE_SUPABASE_HOST] });
}

/* ============================ Stub builders from saved runs ============================ */

const DRAFT_KEYS = ["title", "narrationSegments", "chapters", "openLoops", "claims", "plantSegmentIndex", "payoffSegmentIndex", "callbackKey"];

// A saved script_document -> the draft tool's input shape: schema keys only,
// enrichment stripped (stageDraft re-derives it), auto-extracted claims
// dropped (those are added by claim_verify, never by the model).
export function draftInputFrom(doc: Row): Row {
  const out: Row = {};
  for (const k of DRAFT_KEYS) out[k] = structuredClone(doc[k]);
  out.claims = (out.claims ?? []).filter((c: Row) => !String(c.id).startsWith("auto_"));
  out.chapters = out.chapters.map((c: Row) => ({ chapterId: c.chapterId, title: c.title, segmentIds: c.segmentIds }));
  return out;
}

export function setSegmentText(draft: Row, segmentId: string, text: string) {
  const seg = draft.narrationSegments.find((s: Row) => s.id === segmentId);
  if (!seg) throw new Error(`no segment ${segmentId}`);
  seg.text = text;
  return draft;
}

export function words(text: string) {
  return (text ?? "").trim().split(/\s+/).filter(Boolean).length;
}

// Keeps the first `fraction` of each evidence segment's sentences — a
// deterministic stand-in for Sonnet 5's short first drafts.
export function shortenEvidence(draft: Row, roleByChapter: Map<string, string>, fraction: number) {
  for (const s of draft.narrationSegments) {
    if (roleByChapter.get(s.chapterId) !== "evidence") continue;
    const sentences = s.text.split(/(?<=[.!?])\s+/);
    s.text = sentences.slice(0, Math.max(1, Math.round(sentences.length * fraction))).join(" ");
  }
  return draft;
}
