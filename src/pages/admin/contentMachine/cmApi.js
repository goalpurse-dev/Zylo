// The Content Machine admin API (content-machine-api). A 404/401 means "not the admin": the page then
// shows the site's normal Page Not Found.
import { supabase } from "../../../lib/supabaseClient";

export async function api(action, body = {}) {
  const { data, error } = await supabase.functions.invoke("content-machine-api", { body: { action, ...body } });
  if (error) {
    const status = error?.context?.status;
    let message = "Couldn't reach the server. Try again.";
    try { const j = await error.context.json(); if (j?.message && j.code !== "NOT_FOUND") message = j.message; } catch { /* no body */ }
    const e = new Error(message);
    e.status = status;
    throw e;
  }
  if (!data?.ok) throw new Error(data?.message ?? "Something went wrong.");
  return data.data;
}

export const money = (n, d = 2) => (n == null ? "–" : `$${Number(n).toFixed(d)}`);
export const when = (iso) => (iso ? new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "–");

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch {
    const t = document.createElement("textarea");
    t.value = text; t.style.position = "fixed"; t.style.opacity = "0";
    document.body.appendChild(t); t.select();
    const ok = document.execCommand("copy");
    t.remove();
    return ok;
  }
}
