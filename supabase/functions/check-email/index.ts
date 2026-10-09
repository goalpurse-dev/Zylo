// check-email/index.ts — "can this address receive email?", asked by the sign-up
// screens before an account is created (src/lib/emailCheck.js).
//   POST { email } → { ok: true } or { ok: false, reason, suggestion? }
// reason: "format" (not an address), "typo" (gmsil.com → suggestion gmail.com),
// "disposable" (a throwaway inbox), "no_mail_server" (the domain doesn't exist or
// accepts no mail). Reads and writes nothing in the database. If the DNS lookup
// itself fails, the address is accepted: a hiccup here must not block sign-ups.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ok, err, cors } from "../shared/cors.ts";
import { checkEmailAddress } from "../_shared/emailRules.js";

type Dns = { Status: number; Answer?: { type: number; data: string }[] };
async function lookup(name: string, type: "MX" | "A"): Promise<Dns> {
  const res = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`, {
    headers: { accept: "application/dns-json" }, signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) throw new Error(`dns ${res.status}`);
  return await res.json();
}

// true = accepts mail, false = certainly doesn't, null = couldn't find out.
export async function hasMailServer(domain: string): Promise<boolean | null> {
  try {
    const mx = await lookup(domain, "MX");
    if (mx.Status === 3) return false;                                     // the domain doesn't exist
    if (mx.Status !== 0) return null;
    const hosts = (mx.Answer ?? []).filter((a) => a.type === 15).map((a) => a.data.trim().split(/\s+/).pop() ?? "");
    if (hosts.length) return hosts.some((h) => h !== "." && h !== "");     // "0 ." = "this domain takes no mail"
    const a = await lookup(domain, "A");                                   // no MX: mail falls back to the A record
    if (a.Status !== 0) return null;
    return (a.Answer ?? []).some((r) => r.type === 1);
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return err(req, "Method not allowed", 405);
  const body = await req.json().catch(() => ({}));
  const check = checkEmailAddress(body?.email);
  if (!check.ok) return ok(req, { ok: false, reason: check.reason, suggestion: check.suggestion ?? null });
  const accepts = await hasMailServer(check.email.split("@")[1]);
  if (accepts === false) return ok(req, { ok: false, reason: "no_mail_server", suggestion: null });
  return ok(req, { ok: true });
});
