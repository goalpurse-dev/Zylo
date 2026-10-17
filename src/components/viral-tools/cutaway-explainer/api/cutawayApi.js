import { supabase } from "../../../../lib/supabaseClient";

export const LENGTHS = [15, 30];
export const DEFAULT_LENGTH = 15;
export const TERMINAL_STEPS = new Set(["done", "failed"]);
/** Steps where the server has work to do; the page keeps nudging it ("advance"). */
export const WORKING_STEPS = new Set(["plan", "voice", "wide", "keyframes", "clips", "render"]);

// Prices come from the server (public.tool_prices), see supabase/functions/_shared/cutaway/pricing.js.
export const PRICE_ITEMS = [
  ...LENGTHS.map((s) => ({ id: `plan:${s}`, tool_key: `cutaway:plan-${s}`, input: {} })),
  ...LENGTHS.map((s) => ({ id: `video:${s}`, tool_key: "cutaway:video", input: { durationSec: s } })),
  { id: "image", tool_key: "cutaway:image", input: {} },
];

export function calcCredits(lengthSec, prices = {}) {
  const plan = prices[`plan:${lengthSec}`];
  const video = prices[`video:${lengthSec}`];
  return plan == null || video == null ? null : plan + video;
}

async function call(body) {
  const { data, error } = await supabase.functions.invoke("cutaway-api", { body });
  if (error) {
    let message = error.message || "Something went wrong.";
    try {
      const detail = await error.context?.json?.();
      if (detail?.error) message = detail.error;
    } catch {
      // keep the generic message
    }
    throw new Error(message);
  }
  return data;
}

export const startRun = (topic, lengthSec) => call({ action: "start", topic, lengthSec });
export const advanceRun = (runId) => call({ action: "advance", runId });
export const regenerateImage = (runId, index) => call({ action: "regenerate", runId, index });
export const approveImages = (runId) => call({ action: "approve", runId });

/** Recent runs (the user's own rows, RLS). */
export async function listRuns(limit = 8) {
  const { data, error } = await supabase
    .from("cutaway_runs")
    .select("id, topic, length_sec, step, final_url, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({ id: r.id, topic: r.topic, lengthSec: r.length_sec, step: r.step, finalUrl: r.final_url, createdAt: r.created_at }));
}
