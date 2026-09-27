// deno-lint-ignore-file no-explicit-any
// advance-long-form-chapter-gate/index.ts — "Generate Next Chapter".
//
// 2026-09-22 chapter-by-chapter testing gate. Advances a gated episode
// generation run's chapter boundary to the next chapter once every scene up
// to the current boundary has reached a terminal status — see
// advance_long_form_chapter_gate (20261001140000) for the real logic. This
// is backend-authoritative exactly like pause/continue: the boundary lives
// on long_form_episode_generation_charges and claim_long_form_scene_for_
// render is the one place that enforces it, so there is no frontend-only
// gate anywhere in this path.
//
// POST { projectId }
// Returns { ok: true, chapterGateComplete, chapterGateBoundary, chapterId }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ok, err, cors } from "../shared/cors.ts";
import { requireUser } from "../shared/auth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADVANCE_SECRET = Deno.env.get("LONG_FORM_SCENE_ADVANCE_SECRET") ?? "";
const ADVANCE_URL = `${SUPABASE_URL}/functions/v1/advance-long-form-scene-generation`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return err(req, "Method not allowed", 405);

  const { user, authError } = await requireUser(req);
  if (!user) return err(req, authError || "Unauthorized", 401);

  const body = await req.json().catch(() => ({}));
  const projectId = String(body?.projectId ?? "").trim();
  if (!projectId) return err(req, "Missing projectId", 400);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const { data, error } = await admin.rpc("advance_long_form_chapter_gate", { p_project_id: projectId, p_user_id: user.id });
  if (error) {
    const message = error.message ?? "";
    const status = message.includes("FORBIDDEN") ? 403
      : message.includes("NO_ACTIVE_GENERATION") ? 404
      : message.includes("CHAPTER_GATE_NOT_ACTIVE") ? 409
      : message.includes("CHAPTER_NOT_COMPLETE") ? 409
      : 500;
    const friendly = status === 404 ? "There is no active generation to advance."
      : message.includes("CHAPTER_GATE_NOT_ACTIVE") ? "This generation isn't running in chapter-by-chapter mode."
      : message.includes("CHAPTER_NOT_COMPLETE") ? "The current chapter isn't finished yet."
      : "Could not start the next chapter";
    return err(req, friendly, status);
  }

  // Same pattern as Continue Generation: kick the worker immediately for
  // the newly-eligible scenes rather than waiting for the next cron tick.
  if (data?.visualWorldVersionId) {
    fetch(ADVANCE_URL, { method: "POST", headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json", "x-cron-secret": ADVANCE_SECRET }, body: JSON.stringify({ visualWorldVersionId: data.visualWorldVersionId }) }).catch(() => {});
  }

  return ok(req, { ok: true, chapterGateComplete: Boolean(data?.chapterGateComplete), chapterGateBoundary: data?.chapterGateBoundary ?? null, chapterId: data?.chapterId ?? null });
});
