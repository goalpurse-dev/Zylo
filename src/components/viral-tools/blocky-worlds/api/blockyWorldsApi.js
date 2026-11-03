// Blocky Worlds: the page's side of the blocky-worlds-api contract (supabase/functions/_shared/blockyWorlds/contract.js).
// "server" mode: every preview and production build. "dev" mode: local dev only (?mock=1), the whole flow in the browser
// from the same mock steps the server's mock mode uses (dev/devApi.js); a production build never reaches it.
import { ERRORS, FAILED_MESSAGE, STATUSES, STATUS_LABELS } from "../../../../../supabase/functions/_shared/blockyWorlds/contract.js";
export { ERRORS, FAILED_MESSAGE, STATUSES, STATUS_LABELS };

export const DEV_MOCK = import.meta.env.DEV && new URLSearchParams(window.location.search).has("mock");

/** An error from blocky-worlds-api, with the contract's code and the extras some codes carry. */
export class BlockyWorldsError extends Error {
  constructor(code, message, extra = {}) {
    super(message || ERRORS[code]?.message || ERRORS.SERVER.message);
    this.name = "BlockyWorldsError";
    this.code = code;
    this.status = extra.status ?? ERRORS[code]?.status ?? 0;
    this.credits = Number.isFinite(extra.credits) ? extra.credits : null;
    this.problems = Array.isArray(extra.problems) ? extra.problems : [];
    this.retryAfterSec = Number.isFinite(extra.retryAfterSec) ? extra.retryAfterSec : null;
    this.debug = extra.debug && typeof extra.debug === "object" ? extra.debug : null; // the owner only
  }
}

function codeFrom(status, message = "") {
  if (status === 401) return "SIGN_IN";
  if (status === 402) return /paid plan|upgrade/i.test(message) ? "UPGRADE" : "CREDITS";
  if (status === 403) return "OFF";
  if (status === 404) return "NOT_FOUND";
  if (status === 422) return "NOT_READY";
  if (status === 429) return "LIMIT";
  if (status === 502) return "WRITER";
  if (status === 503) return "BUSY";
  if (status === 400) return "BAD_INPUT";
  return "SERVER";
}
export function errorFromReply(body, status = 0) {
  const message = typeof body?.error === "string" ? body.error : typeof body?.message === "string" ? body.message : "";
  const code = typeof body?.code === "string" && ERRORS[body.code] ? body.code : codeFrom(status, message);
  return new BlockyWorldsError(code, message || ERRORS[code].message, { status, credits: Number(body?.credits), problems: body?.problems, retryAfterSec: Number(body?.retryAfterSec), debug: body?.debug });
}

/** One blocky-worlds-api action. Throws BlockyWorldsError. */
export async function worldsCall(action, body = {}) {
  if (DEV_MOCK) {
    const { devCall } = await import("../dev/devApi");
    return devCall(action, body);
  }
  const { supabase } = await import("../../../../lib/supabaseClient");
  let data, error;
  try {
    ({ data, error } = await supabase.functions.invoke("blocky-worlds-api", { body: { action, ...body } }));
  } catch {
    throw new BlockyWorldsError("SERVER", "We couldn't reach the server. Check your connection and try again.");
  }
  if (error) {
    const res = error.context;
    if (res && typeof res.clone === "function") throw errorFromReply((await res.clone().json().catch(() => null)) ?? {}, res.status ?? 0);
    throw new BlockyWorldsError("SERVER", "We couldn't reach the server. Check your connection and try again.");
  }
  if (data?.error && data?.code) throw errorFromReply(data, ERRORS[data.code]?.status ?? 0);
  return data;
}

/** A video is still being made (the page polls `status` while this is true). */
export const isWorking = (run) => Boolean(run) && !["done", "failed"].includes(run.status);
/** The steps a run goes through, for the progress list. */
export const RUN_STEPS = STATUSES.filter((s) => !["done", "failed"].includes(s));

/** "1:30" */
export const clock = (sec) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}`;
