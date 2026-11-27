// deno-lint-ignore-file no-explicit-any
// director-api: THE DIRECTOR (docs/studio-v2-plan.md B). Plan a video as a storyboard (free, capped per day), change
// it in chat ("only what was asked changes", enforced in _shared/director/storyboard.js applyRevision), save the
// user's own edits, list / get / delete drafts. The logic is _shared/director/api.js (tested in Node); the tables, the
// user and the planner (Claude Sonnet 5.5, OpenAI as the backup) are _shared/director/deno.ts, shared with maestro-api.
// OWNER-ONLY (owner 2026-11-27): STUDIO_V2_ACCESS (_shared/studioV2/access.js), the same switch and owner list as
// maestro-api; anyone else gets a 404 before anything is read or planned.
// Deploy with verify_jwt on (a signed-in user only).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { cors, ok, err } from "../shared/cors.ts";
import { requireUser } from "../shared/auth.ts";
import { DirectorError } from "../_shared/director/api.js";
import { makeDirectorFor } from "../_shared/director/deno.ts";
import { blockyOwners } from "../_shared/blockyWorlds/gate.js";
import { STUDIO_V2_CLOSED, studioV2Allowed } from "../_shared/studioV2/access.js";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const director = makeDirectorFor(admin);
const OWNERS = blockyOwners(Deno.env.get("BLOCKY_WORLDS_OWNER_EMAILS")).map((e: string) => e.toLowerCase());

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== "POST") return err(req, "Method not allowed", 405);
  const { user: u, authError } = await requireUser(req);
  if (authError || !u) return err(req, "Sign in to plan a video.", 401, { code: "SIGN_IN" });
  const text = await req.text();
  if (text.length > 60_000) return err(req, "That's too much text.", 413, { code: "BAD_INPUT" });
  let body: any = {};
  try { body = JSON.parse(text || "{}"); } catch { return err(req, "Bad request.", 400, { code: "BAD_INPUT" }); }
  if (!studioV2Allowed({ mode: Deno.env.get("STUDIO_V2_ACCESS"), user: u, owners: OWNERS })) {
    return new Response(JSON.stringify(STUDIO_V2_CLOSED), { status: 404, headers: { ...cors(req), "content-type": "application/json" } });
  }
  try {
    return ok(req, await director.handle(u.id, body));
  } catch (e) {
    if (e instanceof DirectorError) return err(req, e.message, e.status, { code: e.code, ...e.extra });
    console.error("[director-api]", (e as any)?.message ?? e);
    return err(req, "Something went wrong on our side.", 500, { code: "SERVER" });
  }
});
