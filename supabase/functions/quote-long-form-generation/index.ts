// Read-only authoritative readiness + episode/chapter quote. No writes,
// provider calls, jobs or credit changes.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ok, err, cors } from "../shared/cors.ts";
import { requireUser } from "../shared/auth.ts";
import { loadEpisodePreflight } from "../_shared/episodePreflight.ts";
import { generationReadinessMessage, classifyVisualWorldReadinessReason, classifyPreflightErrors } from "../_shared/generationReadiness.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return err(req, "Method not allowed", 405);
  const { user, authError } = await requireUser(req);
  if (!user) return err(req, authError || "Unauthorized", 401);
  const body = await req.json().catch(() => ({}));
  const projectId = String(body?.projectId ?? "").trim();
  const tier = String(body?.tier ?? "v3").trim();
  const chapterMode = Boolean(body?.chapterMode);
  if (!projectId || !["v2", "v3", "v4"].includes(tier)) return err(req, "Invalid quote request", 400);
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  try {
    const preflight = await loadEpisodePreflight(admin, projectId, user.id, tier);
    if (!preflight.ok) {
      const reason = String(preflight.errors?.[0]?.reason ?? "COMPILE_FAILED");
      const beatsById = new Map((preflight.context?.plan?.visualBeats ?? []).map((b: any) => [b.id, b]));
      const issues = classifyPreflightErrors(preflight.errors ?? [], beatsById);
      return ok(req, { ready: false, reason, message: generationReadinessMessage(reason), issues, errors: preflight.errors?.slice(0, 5) ?? [] });
    }
    const { data, error } = await admin.rpc("quote_long_form_generation", { p_project_id: projectId, p_user_id: user.id, p_tier: tier, p_chapter_mode: chapterMode });
    if (error) throw error;
    if (!data?.ready) {
      const reason = String(data?.reason ?? "not_ready");
      const missingCount = Number(data?.missingRequiredReferenceCount ?? 0);
      return ok(req, { ...data, message: generationReadinessMessage(reason, missingCount), issues: [classifyVisualWorldReadinessReason(reason, missingCount)] });
    }
    return ok(req, data);
  } catch (error) {
    const raw = error instanceof Error ? error.message : String(error);
    const reason = raw.includes("GENERATE_PREFLIGHT_FAILED_VISUAL_WORLD:") ? raw.split(":").pop()! : raw;
    return ok(req, { ready: false, reason, message: generationReadinessMessage(reason), issues: [classifyVisualWorldReadinessReason(reason)] });
  }
});
