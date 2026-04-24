// supabase/functions/_shared/eligibility.ts
import { msToDH, addDays } from "./time.ts";

export type EligibilityResult = {
  allowed: boolean;
  plan_code: string;
  remaining: number | "unlimited";
  limit: number;
  window_days: number;
  reset_in?: { days: number; hours: number };
  reset_at?: string; // ISO
  reason?: string;
};

const FREE_LIMIT = 5;
const WINDOW_DAYS = 30;

export async function getPlanCode(supabase: any, userId: string): Promise<string> {
  const { data, error } = await supabase
    .from("profiles")
    .select("plan_code")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
 return (data?.plan_code || "free").toLowerCase();
}

export async function checkWeeklyFreeEligibility(supabase: any, userId: string): Promise<EligibilityResult> {
  const plan_code = (await getPlanCode(supabase, userId)) || "free";

  // Paid plans: unlimited by weekly rule (you can add credit checks later if you want)
  if (plan_code !== "free") {
    return {
      allowed: true,
      plan_code,
      remaining: "unlimited",
      limit: FREE_LIMIT,
      window_days: WINDOW_DAYS,
    };
  }

  // Count from jobs table — single source of truth, accurate across all devices.
  const sinceIso = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { count, error: countError } = await supabase
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("type", "image")
    .eq("status", "succeeded")
    .gte("created_at", sinceIso);

  if (countError) throw new Error(countError.message);

  const used = count ?? 0;
  const remaining = Math.max(0, FREE_LIMIT - used);

  if (used < FREE_LIMIT) {
    return {
      allowed: true,
      plan_code,
      remaining,
      limit: FREE_LIMIT,
      window_days: WINDOW_DAYS,
    };
  }

  // Blocked: compute reset time = when the oldest of the last 3 becomes > 7 days old
  const { data: rows, error: rowsError } = await supabase
    .from("jobs")
    .select("created_at")
    .eq("user_id", userId)
    .eq("type", "image")
    .eq("status", "succeeded")
    .order("created_at", { ascending: false })
    .limit(FREE_LIMIT);

  if (rowsError) throw new Error(rowsError.message);

  const oldest = rows?.[FREE_LIMIT - 1]?.created_at;
  if (!oldest) {
    // Fallback (shouldn't happen if used >= 3)
    return {
      allowed: false,
      plan_code,
      remaining: 0,
      limit: FREE_LIMIT,
      window_days: WINDOW_DAYS,
      reason: "Monthly limit reached",
    };
  }

  const oldestDate = new Date(oldest);
  const resetAt = addDays(oldestDate, WINDOW_DAYS);
  const msLeft = resetAt.getTime() - Date.now();
  const reset_in = msToDH(msLeft);

  return {
    allowed: false,
    plan_code,
    remaining: 0,
    limit: FREE_LIMIT,
    window_days: WINDOW_DAYS,
    reset_in,
    reset_at: resetAt.toISOString(),
    reason: "Monthly free limit reached",
  };
}

export function assertFreeGeneratorAllowed(
  plan_code: string,
  generator: string | null | undefined
) {
  const FREE_GENERATOR = "image:flux.base";
  const g = (generator || FREE_GENERATOR).toLowerCase();

  if (plan_code === "free" && g !== FREE_GENERATOR) {
    const e = new Error("Generator locked on free plan");
    // @ts-ignore
    e.status = 403;
    // @ts-ignore
    e.payload = {
      reason: "locked_generator",
      allowed_generators: [FREE_GENERATOR],
      requested: g,
    };
    throw e;
  }

  return g;
}