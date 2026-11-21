// deno-lint-ignore-file no-explicit-any
// Blocky Worlds STUDIO ENGINE: the Supabase side (blocky-worlds-api and blocky-worlds-render). studioRuns.js decides;
// this file reads and writes the tables, and sends "your video is ready" through the ONE email gate (userEmail.ts:
// claim_email_send first, category "account", once per run). The worker itself never sends email and holds no Resend key.
//
// Function secrets read here:
//   BLOCKY_WORLDS_ENGINE=studio        new videos are made by the Studio worker (studio.js engineFrom)
//   BLOCKY_WORLDS_READY_EMAIL=on       the ready email (default off)
import { makeStudioRuns, studioFailAlert } from "./studioRuns.js";
import { readyEmail, readyEmailKind, readyEmailOn, READY_WHY, studioQueue, workerAlive } from "./studio.js";
import { claimEmail, FINAL_REASONS, sendClaimedEmail } from "../userEmail.ts";
import { checkEmailAddress, REPLY_TO, WELCOME_SENDER } from "../emailRules.js";
import { alertOnce } from "../adminAlert.ts";

const env = (k: string) => (Deno.env.get(k) ?? "").trim();
const TERMINAL = "(done,failed)";
const now = () => new Date().toISOString();

export function studioDb(admin: any) {
  return {
    async liveStudioRuns(limit: number) {
      const { data, error } = await admin.from("blocky_worlds_runs").select("id,user_id,title,status,engine,created_at,claimed_at,heartbeat_at,stage_at,progress:render->progress,worker_id,credits_charged,refunded_at,length_sec")
        .eq("engine", "studio").not("status", "in", TERMINAL).is("deleted_at", null).order("created_at").limit(limit);
      if (error) throw new Error(`studio runs: ${error.message}`);
      return data ?? [];
    },
    async updateRun(id: string, patch: any, guard: any = {}) {
      let q = admin.from("blocky_worlds_runs").update({ ...patch, updated_at: now() }).eq("id", id);
      if (guard.notTerminal) q = q.not("status", "in", TERMINAL);
      if (guard.worker) q = q.eq("worker_id", guard.worker);
      const { data, error } = await q.select("id").maybeSingle();
      if (error) throw new Error(`studio run update: ${error.message}`);
      return data ?? null;
    },
    async refund(runId: string) {
      const { data, error } = await admin.rpc("blocky_worlds_refund", { p_run: runId });
      if (error) throw new Error(error.message);
      return Number(data) || 0;
    },
    async alert(key: string, subject: string, text: string) { await alertOnce(admin, key, 3600, subject, text); },
    async doneUnnotified(limit: number) {
      const since = new Date(Date.now() - 86400000).toISOString();
      const { data, error } = await admin.from("blocky_worlds_runs").select("id,user_id,title,status,engine,finished_at,notified_at,deleted_at,length_sec")
        .eq("engine", "studio").eq("status", "done").is("notified_at", null).is("deleted_at", null).gt("finished_at", since).order("finished_at").limit(limit);
      if (error) throw new Error(`studio done runs: ${error.message}`);
      return data ?? [];
    },
    async markNotified(id: string) {
      const { data } = await admin.from("blocky_worlds_runs").update({ notified_at: now() }).eq("id", id).is("notified_at", null).select("id").maybeSingle();
      return data ?? null;
    },
  };
}

/**
 * One ready email through the gate: true = done with this run (sent, or a final "never" from the gate: no consent
 * needed for an account email, but a suppressed / bad address is final), false = try again on the next sweep.
 */
export async function sendReadyEmail(admin: any, run: any): Promise<boolean> {
  const { data: u } = await admin.auth.admin.getUserById(run.user_id);
  const address = checkEmailAddress(u?.user?.email ?? "");
  if (!address.ok) return true;
  const claim = await claimEmail(admin, address.email, readyEmailKind(run.id), "account");
  if (!claim.ok) return FINAL_REASONS.has(claim.reason);
  const mail = readyEmail({ title: run.title });
  return await sendClaimedEmail(admin, {
    claimId: claim.id, to: address.email, userId: run.user_id, from: WELCOME_SENDER, replyTo: REPLY_TO.founder,
    subject: mail.subject, why: READY_WHY, render: mail.render,
    tags: [{ name: "kind", value: "blocky_worlds_ready" }],
  });
}

/** the sweeper's Studio pass (pg_cron every minute): dead workers / stuck runs -> failed + refunded; ready emails */
export async function sweepStudio(admin: any) {
  const runs = makeStudioRuns({ db: studioDb(admin), log: (...a: unknown[]) => console.log("[blocky-worlds-studio]", ...a) });
  const swept = await runs.sweep();
  const mail = readyEmailOn((k: string) => env(k)) ? await runs.notifyReady((run: any) => sendReadyEmail(admin, run)) : { sent: 0, off: true };
  // the worker has no Resend key: the runs IT failed in the last ~90 s are mailed to the owner here (alertOnce: one email
  // per failure code an hour; the sweeper's own failures were mailed by failRun already)
  let alerted = 0;
  try {
    const since = new Date(Date.now() - 90000).toISOString();
    const { data } = await admin.from("blocky_worlds_runs").select("id,title,error_code,error_message,credits_refunded,worker_id")
      .eq("engine", "studio").eq("status", "failed").not("worker_id", "is", null).gt("finished_at", since).limit(20);
    for (const r of data ?? []) {
      if (["QUEUE_TIMEOUT", "WORKER_LOST", "TIMEOUT"].includes(r.error_code)) continue; // the sweeper's own: mailed already
      // THE CUSTOMER GATE (owner 2026-11-21: "refund the credits automatically and email me"): one email PER RUN (not one
      // per code an hour), with the pass share and the top failing reasons (the run's error message: studioRuns.js studioFailAlert)
      const m = studioFailAlert(r);
      await alertOnce(admin, m.key, 3600, m.subject, m.text);
      alerted++;
    }
  } catch (e: any) { console.error("[blocky-worlds-studio] failure alerts:", e?.message ?? e); }
  return { ...swept, ...mail, alerted };
}

/** start refuses before any charge unless a Studio worker said hello lately (any error: refused, fail closed) */
export async function studioWorkerAlive(admin: any): Promise<boolean> {
  const { data, error } = await admin.from("blocky_worlds_workers").select("id,seen_at").order("seen_at", { ascending: false }).limit(5);
  if (error) { console.error("[blocky-worlds-studio] workers:", error.message); return false; }
  return workerAlive(data ?? []);
}

/** { [runId]: { queuePosition, etaSec, doneEtaSec } } for working Studio runs (bookkeeping: any error -> {}) */
export async function studioQueueInfo(admin: any, runs: any[]): Promise<Record<string, any>> {
  try {
    const mine = runs.filter((r) => r.engine === "studio" && !["done", "failed"].includes(r.status));
    if (!mine.length) return {};
    const { data, error } = await admin.from("blocky_worlds_runs").select("id,status,worker_id,created_at,length_sec").eq("engine", "studio").eq("status", "queued").is("deleted_at", null).order("created_at").limit(100);
    if (error) return {};
    return Object.fromEntries(mine.map((r) => [r.id, studioQueue(r, data ?? [])]));
  } catch { return {}; }
}
