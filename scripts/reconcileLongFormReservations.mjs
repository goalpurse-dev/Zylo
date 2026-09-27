// Phase 0, Section B.5 — one-time reconciliation for
// long_form_project_reservations rows left `status='reserved'` from BEFORE
// this phase's release/settle wiring existed (see supabase/functions/
// delete-long-form-project, generate-long-form-narration-audio,
// advance-long-form-script, advance-long-form-research,
// generate-long-form-story-plan, and _shared/longFormReservations.ts).
//
// SAFE BY DEFAULT: runs as a dry-run report unless --apply is passed
// explicitly. Never touches profiles.credit_balance directly — every
// change goes through the same release_long_form_reservation /
// settle_long_form_reservation RPCs the live pipeline itself now uses, so
// this can never do anything the real wiring couldn't also have done.
//
// Usage:
//   node scripts/reconcileLongFormReservations.mjs            # dry-run report only
//   node scripts/reconcileLongFormReservations.mjs --apply    # actually release/settle
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local", quiet: true });
import { createClient } from "@supabase/supabase-js";

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const APPLY = process.argv.includes("--apply");

// A `reserved` reservation is "stuck" (should have already been
// released/settled) once its project has reached a state nothing currently
// reachable from it can change:
//   - the project itself was deleted (deleted_at is set)
//   - the project's Story Plan generation failed terminally (planning_failed)
//   - the project's current script version failed terminally
//   - the project's narration audio reached a terminal state: 'ready'
//     (settle — this is "the end of the last real stage that exists" per
//     longFormReservations.ts) or 'failed' (release — nothing produced)
// A project still genuinely in-flight (no terminal signal yet) is left
// alone — reconciling it now would be premature, not a fix.
async function findStuckReservations() {
  const { data: reservations, error } = await admin
    .from("long_form_project_reservations")
    .select("id, project_id, user_id, reserved_credits, committed_credits, created_at")
    .eq("status", "reserved");
  if (error) throw error;
  if (!reservations.length) return [];

  const projectIds = reservations.map((r) => r.project_id);
  const { data: projects, error: projError } = await admin
    .from("long_form_projects")
    .select("id, status, deleted_at, current_script_version_id, topic")
    .in("id", projectIds);
  if (projError) throw projError;
  const projectById = new Map(projects.map((p) => [p.id, p]));

  const scriptVersionIds = projects.map((p) => p.current_script_version_id).filter(Boolean);
  const { data: scripts } = scriptVersionIds.length
    ? await admin.from("long_form_script_versions").select("id, status").in("id", scriptVersionIds)
    : { data: [] };
  const scriptStatusById = new Map((scripts ?? []).map((s) => [s.id, s.status]));

  const { data: narrations } = await admin
    .from("long_form_narration_audio_versions")
    .select("project_id, status, created_at")
    .in("project_id", projectIds)
    .order("created_at", { ascending: false });
  const latestNarrationByProject = new Map();
  for (const n of narrations ?? []) {
    if (!latestNarrationByProject.has(n.project_id)) latestNarrationByProject.set(n.project_id, n.status);
  }

  const stuck = [];
  for (const r of reservations) {
    const project = projectById.get(r.project_id);
    if (!project) continue; // shouldn't happen (FK), but never act on a reservation we can't explain
    const scriptStatus = project.current_script_version_id ? scriptStatusById.get(project.current_script_version_id) : null;
    const narrationStatus = latestNarrationByProject.get(r.project_id) ?? null;

    let action = null;
    let reason = null;
    if (project.deleted_at) {
      action = "release"; reason = "project_deleted";
    } else if (project.status === "planning_failed") {
      action = "release"; reason = "story_plan_failed";
    } else if (scriptStatus === "failed") {
      action = "release"; reason = "script_failed";
    } else if (narrationStatus === "failed") {
      action = "release"; reason = "narration_failed";
    } else if (narrationStatus === "ready") {
      action = "settle"; reason = "narration_ready";
    }

    if (action) stuck.push({ ...r, project_topic: project.topic, action, reason });
  }
  return stuck;
}

async function main() {
  const stuck = await findStuckReservations();
  console.log(`Found ${stuck.length} stuck reservation(s) eligible for reconciliation.\n`);

  if (stuck.length === 0) {
    console.log("Nothing to reconcile.");
    return;
  }

  const perUser = new Map();
  for (const r of stuck) {
    const unspent = r.reserved_credits - r.committed_credits;
    const entry = perUser.get(r.user_id) ?? { userId: r.user_id, reservations: 0, totalUnspentCredits: 0 };
    entry.reservations += 1;
    entry.totalUnspentCredits += unspent;
    perUser.set(r.user_id, entry);
  }

  console.log("=== Per-reservation detail ===");
  for (const r of stuck) {
    const unspent = r.reserved_credits - r.committed_credits;
    console.log(
      `  [${r.action.toUpperCase()}] reservation ${r.id} — project "${r.project_topic}" (${r.project_id}) — ` +
      `user ${r.user_id} — reserved ${r.reserved_credits}, committed ${r.committed_credits}, would refund ${unspent} — reason: ${r.reason}`
    );
  }

  console.log("\n=== Per-user summary (dry-run) ===");
  for (const entry of perUser.values()) {
    console.log(`  user ${entry.userId}: ${entry.reservations} reservation(s), total refund ${entry.totalUnspentCredits} credits`);
  }

  if (!APPLY) {
    console.log("\nDry run only — no changes made. Re-run with --apply to actually release/settle these reservations.");
    return;
  }

  console.log("\n=== APPLYING ===");
  for (const r of stuck) {
    const rpc = r.action === "release" ? "release_long_form_reservation" : "settle_long_form_reservation";
    const { data, error } = await admin.rpc(rpc, { p_reservation_id: r.id, p_user_id: r.user_id });
    if (error) {
      console.log(`  FAILED ${rpc} for reservation ${r.id}: ${error.message}`);
      continue;
    }
    console.log(`  OK ${rpc} for reservation ${r.id} -> status=${data.status}, refunded=${data.released_credits}`);
  }
}

main().catch((e) => {
  console.error("RECONCILIATION SCRIPT FAILED:", e);
  process.exit(1);
});
