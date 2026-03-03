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