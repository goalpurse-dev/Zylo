// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

// ✅ CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export default Deno.serve(async (req) => {
  // ✅ Handle preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");

  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: {
      headers: { Authorization: authHeader },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  // ✅ Read from public.profiles
  const { data, error } = await supabase
    .from("profiles")
    .select("plan_code")
    .eq("id", user.id)
    .single();

  if (error || !data) {
    return new Response(JSON.stringify({ error: "Profile not found" }), {
      status: 500,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  const plan = data.plan_code;

  let bg_library_limit = 0;
  if (plan === "starter") bg_library_limit = 30;
  else if (plan === "pro") bg_library_limit = 100;
  else if (plan === "generative") bg_library_limit = -1;

  return new Response(
    JSON.stringify({
      features: {
        plan_tier: plan,
        bg_library_limit,
      },
    }),
    {
      headers: {
        ...corsHeaders,
        "content-type": "application/json",
      },
    }
  );
});
