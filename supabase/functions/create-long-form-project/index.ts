// create-long-form-project/index.ts
//
// The commitment boundary for Long Form: nothing in long_form_projects
// exists while a user is only browsing ideas — that all lives in
// long_form_discovery_sessions, which is disposable. Clicking "Create Story
// Plan" is the first moment a real Video Project should exist.
//
// Idempotent by discoverySessionId, which the frontend already creates
// exactly once per /long-form/new visit for BOTH "Start with a topic" and
// "Discover ideas" (see discoverySession.js) — reusing it here means one
// project per session, always, with no second identity concept to invent,
// and it's what keeps a manual topic and a discovered idea on the exact
// same downstream pipeline (both just become a long_form_projects row).
// A double-click or a refresh mid-request simply finds the row that
// already exists for that session and returns it instead of creating a
// second one.
//
// POST {
//   discoverySessionId, topic, source,
//   selectedIdeaId?, selectedIdeaTitle?, selectedIdeaAngle?, narrativeArchetypeHint?,
//   lengthMode, customLengthMinutes?, depthMode, customExplanationDepth?,
//   initialStatus?
// }
// Returns { id, status, ...project fields already known to the client }
//
// 2026-10-03 "fixes round 3" pass, Section 1: `initialStatus` lets a caller
// insert as 'draft' instead of the historical 'planning' default — the new
// Production Setup flow (ProductionSetup.jsx) uses this so the project stays
// invisible in "Your Long Form Videos" (fetchUserLongFormProjects filters
// status='draft' out) until Generate's credit reservation actually succeeds,
// at which point create-long-form-production-setup flips it to 'planning'
// itself. Every existing caller (the legacy /long-form/new page) omits this
// field entirely and gets the exact same 'planning' behavior as before —
// zero change for them.
const VALID_INITIAL_STATUSES = new Set(["planning", "draft"]);

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ok, err, cors } from "../shared/cors.ts";
import { requireUser } from "../shared/auth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const PROJECT_COLUMNS =
  "id, status, source, topic, selected_idea_id, selected_idea_title, selected_idea_angle, narrative_archetype_hint, " +
  "length_mode, custom_length_minutes, depth_mode, custom_explanation_depth, " +
  "resolved_length_minutes, resolved_explanation_depth, target_words, on_screen_text_density, " +
  "current_story_plan_version_id, discovery_session_id, created_at, updated_at";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return err(req, "Method not allowed", 405);

  const { user, authError } = await requireUser(req);
  if (!user) return err(req, authError || "Unauthorized", 401);

  const body = await req.json().catch(() => ({}));
  const discoverySessionId = String(body?.discoverySessionId ?? "").trim();
  const topic = String(body?.topic ?? "").trim();
  const source = body?.source === "discovery" ? "discovery" : "custom";
  const lengthMode = body?.lengthMode === "custom" ? "custom" : "auto";
  const depthMode = body?.depthMode === "custom" ? "custom" : "auto";
  // Part 2/3 (2026-09-15 content-grounding pass): chosen once, up front —
  // the only point in the current flow that is genuinely BEFORE the
  // storyboard compiles (see visualShotPlanning.js's refineVisualSequences,
  // the sole consumer). Defaults to the column's own default (balanced) for
  // any caller that omits it.
  const onScreenTextDensity = ["minimal", "balanced", "frequent"].includes(body?.onScreenTextDensity) ? body.onScreenTextDensity : "balanced";
  const initialStatus = VALID_INITIAL_STATUSES.has(body?.initialStatus) ? body.initialStatus : "planning";

  if (!discoverySessionId) return err(req, "Missing discoverySessionId", 400);
  if (!topic) return err(req, "Missing topic", 400);
  if (topic.length > 2000) return err(req, "Topic is too long", 400);

  const customLengthMinutes =
    lengthMode === "custom" && Number.isFinite(Number(body?.customLengthMinutes))
      ? Math.min(20, Math.max(5, Math.round(Number(body.customLengthMinutes))))
      : null;
  const customExplanationDepth =
    depthMode === "custom" && ["simple", "balanced", "deep"].includes(body?.customExplanationDepth)
      ? body.customExplanationDepth
      : null;

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const { data: session } = await admin
    .from("long_form_discovery_sessions")
    .select("id, user_id")
    .eq("id", discoverySessionId)
    .maybeSingle();
  if (!session) return err(req, "Discovery session not found", 404);
  if (session.user_id !== user.id) return err(req, "Forbidden", 403);

  const { data: existing } = await admin
    .from("long_form_projects")
    .select(PROJECT_COLUMNS)
    .eq("discovery_session_id", discoverySessionId)
    .maybeSingle();
  if (existing) return ok(req, existing);

  const selectedIdeaId = body?.selectedIdeaId ? String(body.selectedIdeaId).slice(0, 200) : null;
  const selectedIdeaTitle = body?.selectedIdeaTitle ? String(body.selectedIdeaTitle).slice(0, 300) : null;
  const selectedIdeaAngle = body?.selectedIdeaAngle ? String(body.selectedIdeaAngle).slice(0, 500) : null;
  const narrativeArchetypeHint = body?.narrativeArchetypeHint ? String(body.narrativeArchetypeHint).slice(0, 100) : null;

  const { data: inserted, error: insertError } = await admin
    .from("long_form_projects")
    .insert({
      user_id: user.id,
      discovery_session_id: discoverySessionId,
      format: "2d_explainer",
      status: initialStatus,
      source,
      topic,
      selected_idea_id: selectedIdeaId,
      selected_idea_title: selectedIdeaTitle,
      selected_idea_angle: selectedIdeaAngle,
      narrative_archetype_hint: narrativeArchetypeHint,
      length_mode: lengthMode,
      custom_length_minutes: customLengthMinutes,
      depth_mode: depthMode,
      custom_explanation_depth: customExplanationDepth,
      on_screen_text_density: onScreenTextDensity,
    })
    .select(PROJECT_COLUMNS)
    .single();

  if (insertError) {
    // A concurrent request for the same session can race past the check
    // above and hit the discovery_session_id UNIQUE constraint — that's the
    // idempotency guarantee working as intended, not a real failure.
    if (insertError.code === "23505") {
      const { data: race } = await admin.from("long_form_projects").select(PROJECT_COLUMNS).eq("discovery_session_id", discoverySessionId).maybeSingle();
      if (race) return ok(req, race);
    }
    return err(req, "Could not create project", 500);
  }

  return ok(req, inserted);
});
