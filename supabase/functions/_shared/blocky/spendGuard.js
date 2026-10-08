// Blocky Stories' paid-calls switch and daily spending cap.
//
// A paid call is anything that costs US money at a provider: the story writer
// and script editor, pictures, clips, picture and clip checks, the upload
// text. They are all OFF unless
//   - the switch is on:  public.blocky_settings.paid_calls = true  (default false), and
//   - today's spend is under the cap:  blocky_settings.daily_cap_usd  (default $3.00).
// "Today's spend" is what blocky_ai_calls has logged since 00:00 UTC, plus an
// estimate for jobs already charged and still running. A step that would pass
// the cap is refused BEFORE it is charged.
//
// The owner turns paid calls on and off with one row (docs/roblox-scope.md,
// decision 33):  node scripts/blocky/paid.mjs on | off | status | cap 3
// The function secret BLOCKY_PAID_CALLS=off is a second, hard off switch.
//
// Reading the state fails closed: if it can't be read, paid calls are off.

/** What one picture and one second of each clip tier cost us (USD, measured; rounded up for pictures). */
export const COST_USD = Object.freeze({ image: 0.04, clipPerSec: Object.freeze({ v2: 0.0504, v3: 0.0817, v4: 0.15 }) });
/** One story script with its edit pass, a series plan, an edit instruction clean-up, an upload text: rounded up. */
export const WRITER_USD = 0.15;   // three plans on the plan model, the judge, the script, the editor, a rewrite
export const SMALL_USD = 0.01;

/** What a step's items are expected to cost us, before it is charged (steps.js#planStep items). */
export function estimateUsd(items) {
  let usd = 0;
  for (const item of items ?? []) {
    if (item.kind === "image") { usd += COST_USD.image; continue; }
    const tier = String(item.tool_key ?? "").match(/-(v[234])$/)?.[1] ?? "v4";   // unknown tier: the dearest
    usd += (Number(item.price_input?.durationSec) || 15) * COST_USD.clipPerSec[tier];
  }
  return Math.round(usd * 10000) / 10000;
}

const OFF = (reason) => ({ on: false, reason, spentUsd: null, inFlightUsd: null, capUsd: null });

/**
 * The switch and the cap, read fresh.
 * @param {object} admin service-role client
 * @param {string} envValue the BLOCKY_PAID_CALLS function secret ("off" = hard off)
 * @param {number} [addUsd] what the next step is expected to cost
 * @returns {Promise<{on: boolean, reason: null|"switch_off"|"cap_reached"|"unreadable", spentUsd: number|null, inFlightUsd: number|null, capUsd: number|null}>}
 */
export async function readPaidState(admin, envValue, addUsd = 0) {
  if (String(envValue ?? "").toLowerCase() === "off") return OFF("switch_off");
  try {
    const { data, error } = await admin.rpc("blocky_paid_state", { p_add_usd: addUsd });
    if (error || !data || typeof data.on !== "boolean") return OFF("unreadable");
    return { on: data.on, reason: data.on ? null : data.reason ?? "switch_off", spentUsd: Number(data.spent_usd), inFlightUsd: Number(data.in_flight_usd), capUsd: Number(data.cap_usd) };
  } catch {
    return OFF("unreadable");
  }
}
