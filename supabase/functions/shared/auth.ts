// supabase/functions/_shared/auth.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export function supabaseForUser(req: Request) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const authHeader = req.headers.get("Authorization") || "";

  return createClient(supabaseUrl, anonKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });
}

export async function requireUser(req: Request) {
  const supabase = supabaseForUser(req);
  const { data, error } = await supabase.auth.getUser();

  if (error || !data?.user) {
    return { supabase, user: null, authError: error?.message || "Unauthorized" };
  }

  return { supabase, user: data.user, authError: null };
}
// Phase 6a — the Stickman autopilot chains story plan -> research -> script
// server-side on the user's behalf. It authenticates with its own secret
// (x-autopilot-secret) and names the project owner in the body (userId); the
// caller still checks project ownership exactly as for a user request.
export async function requireUserOrAutopilot(req: Request, parsedBody?: any) {
  const secret = Deno.env.get("LONG_FORM_AUTOPILOT_SECRET") ?? "";
  const given = req.headers.get("x-autopilot-secret") ?? "";
  if (secret && given && given === secret) {
    // parsedBody: for handlers that already read the body (it can't be read twice).
    const body = parsedBody ?? (await req.clone().json().catch(() => ({})));
    const userId = String(body?.userId ?? "").trim();
    if (userId) return { supabase: null as any, user: { id: userId } as any, authError: null, internal: true };
    return { supabase: null as any, user: null, authError: "userId required for an internal call", internal: true };
  }
  return { ...(await requireUser(req)), internal: false };
}
