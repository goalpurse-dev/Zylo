// The site's calls to MAESTRO (supabase/functions/maestro-api): send, chats, chat, delete, status. Always with the user's
// own login. Local dev with ?mock=1 only (import.meta.env.DEV is false in every build): a fake Maestro answers in the
// browser (maestroMock.js), so the chat can be clicked through with no Claude call, no account and no credits.
import { supabase } from "./supabaseClient";

const BASE = `${String(import.meta.env.VITE_SUPABASE_URL ?? "").replace(/\/$/, "")}/functions/v1/maestro-api`;
export const MAESTRO_MOCK = Boolean(import.meta.env?.DEV) && typeof window !== "undefined" && new URLSearchParams(window.location.search).get("mock") === "1";

export const MAESTRO_DOWN = "Maestro is taking a break, try again in a minute.";
// tell the ops alerts (ops-health counts these each tick); never breaks the page
function reportDown(action, status) {
  try { supabase.from("marketing_events").insert({ event: "maestro_unreachable", placement: "maestro", target: action, path: window.location.pathname, meta: { status } }).then(() => {}, () => {}); } catch { /* never */ }
}

export class MaestroError extends Error {
  constructor(code, message, extra = {}) { super(message); this.code = code; Object.assign(this, extra); }
}

async function call(action, body = {}) {
  if (MAESTRO_MOCK) {
    const { mockMaestro } = await import("./maestroMock.js");
    return mockMaestro(action, body);
  }
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new MaestroError("SIGN_IN", "Sign in to chat with Maestro.");
  let res;
  try {
    res = await fetch(BASE, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ action, ...body }) });
  } catch {
    reportDown(action, 0);
    throw new MaestroError("DOWN", MAESTRO_DOWN);
  }
  const out = await res.json().catch(() => null);
  // no JSON, or a gateway/server error with none of our own codes: the server didn't really answer
  if (!res.ok && (!out || (res.status >= 500 && !out.code))) { reportDown(action, res.status); throw new MaestroError("DOWN", MAESTRO_DOWN); }
  if (!res.ok) throw new MaestroError(out?.code ?? "SERVER", out?.error ?? "Something went wrong on our side.", out ?? {});
  return out ?? {};
}

/** { chatId?, text, templateId? } -> { chat, messages: [yours, Maestro's], left } */
export const sendToMaestro = (input) => call("send", input);
export const listChats = () => call("chats");
export const getChat = (chatId) => call("chat", { chatId });
export const deleteChat = (chatId) => call("delete", { chatId });
export const maestroStatus = () => call("status");
