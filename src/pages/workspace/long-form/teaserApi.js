// teaserApi.js — the free Long Form teaser's server calls (long-form-teaser)
// and the small pure helpers its screens share.
import { supabase } from "../../../lib/supabaseClient";

async function invoke(body) {
  const { data, error } = await supabase.functions.invoke("long-form-teaser", { body });
  if (error) {
    const payload = await (error.context && typeof error.context.json === "function" ? error.context.json().catch(() => null) : null);
    return { ok: false, status: error.context?.status ?? 500, code: payload?.code ?? null, message: payload?.error ?? "Something went wrong. Try again." };
  }
  return { ok: true, ...data };
}
export const startTeaser = ({ topic, niche, setup }) => invoke({ action: "start", topic, niche, setup });
export const getTeaser = (teaserId) => invoke({ action: "get", teaserId });
// Funnel: upgrade_clicked | paid | full_started (the server keeps the timestamps).
export const teaserEvent = (teaserId, event, extra = {}) => invoke({ action: "event", teaserId, event, ...extra });

export { TEASER_AUTOSTART_KEY, teaserSteps, teaserBusy, fullVideoFacts } from "./teaserView.js";
