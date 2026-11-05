// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

const TABLE_PROFILE = "app_user_profiles";
const TABLE_BGS = "background_library";

function cors(req: Request) {
  const origin = req.headers.get("Origin") ?? "*";
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-credentials": "true",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers":
      req.headers.get("Access-Control-Request-Headers") ??
      "authorization, x-client-info, apikey, content-type",
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors(req) });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
      global: { headers: { Authorization: req.headers.get("Authorization")! } },
    });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "content-type": "application/json", ...cors(req) },
      });
    }

    // Load plan features
    const { data: profile } = await supabase
      .from(TABLE_PROFILE)
      .select("plan:app_plans(code,features)")
      .eq("user_id", user.id)
      .single();

    const features = profile?.plan?.features as any;
    if (!features) {
      return new Response(JSON.stringify({ error: "No features" }), {
        status: 400,
        headers: { "content-type": "application/json", ...cors(req) },
      });
    }

    // Decide BG limit by plan
    let limit = 9999; // generative / unlimited

    if (profile.plan.code === "starter") limit = 30;
    if (profile.plan.code === "pro") limit = 100;

    // Fetch allowed backgrounds (ORDERED)
    const { data: backgrounds, error } = await supabase
      .from(TABLE_BGS)
      .select("id,image_url,category")
      .eq("active", true)
      .order("order_index", { ascending: true })
      .limit(limit);

    if (error) throw error;

    return new Response(
      JSON.stringify({ ok: true, backgrounds }),
      { status: 200, headers: { "content-type": "application/json", ...cors(req) } }
    );
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: "Server error" }), {
      status: 500,
      headers: { "content-type": "application/json", ...cors(req) },
    });
  }
});
