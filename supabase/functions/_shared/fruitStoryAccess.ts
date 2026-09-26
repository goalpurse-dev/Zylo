// deno-lint-ignore-file no-explicit-any
// Shared access checks for the AI Fruit Story edge functions
// (fruit-story-ideas, fruit-story-planner, fruit-story-video-prompts):
// signed-in user, paid plan, and a per-user rate limit backed by
// public.consume_rate_limit (migration 20261007120000).
import { createClient, type SupabaseClient, type User } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Mirrors the Fruit UI: every paid tier plus affiliates (who get the V2 tier
// of every template). free / trial / unknown codes are refused.
const FRUIT_ALLOWED_PLANS = new Set(["starter", "pro", "generative", "affiliate"]);

export const FRUIT_RATE_LIMIT_WINDOW_SECONDS = 10 * 60;

type Failure = { ok: false; response: Response };
type Access = { ok: true; user: User; admin: SupabaseClient };

function errorResponse(cors: Record<string, string>, status: number, error: string, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify({ ok: false, error }), {
    status,
    headers: { ...cors, ...extra, "Content-Type": "application/json" },
  });
}

/** 401 without a valid user JWT, 403 unless the user is on a paid plan. */
export async function requirePaidFruitUser(req: Request, cors: Record<string, string>): Promise<Access | Failure> {
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return { ok: false, response: errorResponse(cors, 401, "Unauthorized") };

  const { data: { user }, error } = await admin.auth.getUser(token);
  if (error || !user) return { ok: false, response: errorResponse(cors, 401, "Unauthorized") };

  const { data: profile } = await admin.from("profiles").select("plan_code").eq("id", user.id).maybeSingle();
  const plan = String((profile as any)?.plan_code ?? "free").toLowerCase().trim();
  if (!FRUIT_ALLOWED_PLANS.has(plan)) {
    return { ok: false, response: errorResponse(cors, 403, "PLAN_UPGRADE_REQUIRED: AI Fruit Story needs a paid plan.") };
  }

  return { ok: true, user, admin };
}

/**
 * Records one call against `bucket` and returns a 429 Response when the user
 * is over `limit` calls per 10 minutes, otherwise null. Fails open (logs and
 * allows) if the limiter itself errors, so a limiter outage can't take the
 * feature down.
 */
export async function consumeFruitRateLimit(
  admin: SupabaseClient,
  userId: string,
  bucket: string,
  limit: number,
  cors: Record<string, string>,
): Promise<Response | null> {
  const { data, error } = await admin.rpc("consume_rate_limit", {
    p_user_id: userId,
    p_bucket: bucket,
    p_limit: limit,
    p_window_seconds: FRUIT_RATE_LIMIT_WINDOW_SECONDS,
  });
  if (error) {
    console.error(`[${bucket}] rate limiter unavailable — allowing request`, error.message);
    return null;
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (row && row.allowed === false) {
    const retryAfter = String(Math.max(1, Number(row.retry_after_seconds) || FRUIT_RATE_LIMIT_WINDOW_SECONDS));
    return errorResponse(cors, 429, `Too many requests. Try again in ${retryAfter}s.`, { "Retry-After": retryAfter });
  }
  return null;
}
