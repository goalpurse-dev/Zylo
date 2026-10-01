// Phase 6c — settle at render (Stickman) + the 7-day idle safety rule + delete still releases.
import { assert, assertEquals, assertMatch } from "jsr:@std/assert@1";
import { isReservationIdle, lastActivityAt, settleIdleReservations, RESERVATION_IDLE_SETTLE_DAYS } from "../../supabase/functions/_shared/longFormReservations.ts";

const NOW = "2026-10-10T12:00:00.000Z";
const daysAgo = (d: number) => new Date(Date.parse(NOW) - d * 86_400_000).toISOString();
const read = (p: string) => Deno.readTextFileSync(new URL(`../../${p}`, import.meta.url));

Deno.test("idle rule: 7 days without activity -> settle; any newer activity keeps the reservation", () => {
  assertEquals(RESERVATION_IDLE_SETTLE_DAYS, 7);
  assert(isReservationIdle(daysAgo(7), NOW));
  assert(!isReservationIdle(daysAgo(6.9), NOW));
  assert(!isReservationIdle(null, NOW));
  // Activity is the NEWEST of reservation / project / heartbeat / ledger.
  assertEquals(lastActivityAt([daysAgo(20), daysAgo(2), null, daysAgo(9)]), daysAgo(2));
});

// A tiny in-memory stand-in for the Supabase client (only what settleIdleReservations touches).
function fakeAdmin(db: { reservations: any[]; projects: Record<string, any>; ledger: Record<string, string | null> }) {
  const settled: string[] = [];
  const q = (table: string) => {
    const f: Record<string, unknown> = {};
    const api: any = {
      select: () => api, eq: (k: string, v: unknown) => { f[k] = v; return api; }, lt: () => api, order: () => api, limit: () => api,
      maybeSingle: async () => {
        if (table === "long_form_projects") return { data: db.projects[f.id as string] ?? null };
        if (table === "long_form_cost_ledger") return { data: db.ledger[f.project_id as string] ? { created_at: db.ledger[f.project_id as string] } : null };
        if (table === "long_form_project_reservations") return { data: db.reservations.find((r) => r.project_id === f.project_id && r.status === "reserved") ?? null };
        return { data: null };
      },
      then: (res: any) => res({ data: table === "long_form_project_reservations" ? db.reservations.filter((r) => r.status === "reserved") : [] }),
    };
    return api;
  };
  // The idle rule now closes the hold (close_long_form_reservation, by project id).
  const rpc = async (_: string, a: any) => {
    const r = db.reservations.find((x) => (a.p_reservation_id ? x.id === a.p_reservation_id : x.project_id === a.p_project_id && x.status === "reserved"));
    if (!r) return { data: null, error: null };
    r.status = "settled"; settled.push(r.project_id);
    return { data: { ...r, close_reason: a.p_reason }, error: null };
  };
  return { admin: { from: q, rpc } as any, settled };
}

Deno.test("cron: settles only the idle, non-running projects", async () => {
  const db = {
    reservations: [
      { id: "r1", project_id: "idle", user_id: "u", status: "reserved", created_at: daysAgo(10), reserved_credits: 300, committed_credits: 40 },
      { id: "r2", project_id: "recentLedger", user_id: "u", status: "reserved", created_at: daysAgo(10), reserved_credits: 300, committed_credits: 0 },
      { id: "r3", project_id: "running", user_id: "u", status: "reserved", created_at: daysAgo(10), reserved_credits: 300, committed_credits: 0 },
    ],
    projects: { idle: { updated_at: daysAgo(8), autopilot: { status: "done", heartbeatAt: daysAgo(8) } }, recentLedger: { updated_at: daysAgo(9), autopilot: null }, running: { updated_at: daysAgo(9), autopilot: { status: "running" } } },
    ledger: { idle: daysAgo(8), recentLedger: daysAgo(1), running: null },
  };
  const { admin, settled } = fakeAdmin(db);
  const out = await settleIdleReservations(admin, NOW);
  assertEquals(out.settled, ["idle"]);
  assertEquals(settled, ["idle"]);
});

Deno.test("wiring: the cron runs the idle rule; settle-at-render is Stickman-only; delete still releases", () => {
  assertMatch(read("supabase/functions/advance-long-form-autopilot/index.ts"), /settleIdleReservations\(admin, new Date\(\)\.toISOString\(\), logEvent\)/);
  const gen = read("supabase/functions/generate-long-form-narration-audio/index.ts");
  assertMatch(gen, /const settleAtNarration = !\(SETTLE_AT_RENDER && profile\.visual_recipe === "stickman_doodle_explainer"\);/);
  assertMatch(read("supabase/functions/delete-long-form-project/index.ts"), /releaseReservationIfActive\(admin, projectId, "project_deleted"/);
  // The render finish still settles (Phase 5b).
  assertMatch(read("supabase/functions/finish-long-form-render/index.ts"), /applyRenderBilling|settleReservationIfActive/);
});
