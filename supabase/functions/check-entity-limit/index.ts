// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

/** Map your real table names here */
const TABLE_PROFILE = "app_user_profiles";
const T_BRANDS      = "brands";
const T_PRODUCTS    = "products";
const T_AVATARS     = "avatars";

type Req = { type: "brand"|"product"|"avatar"; brandId?: string };

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
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });

  try {
    const body = (await req.json()) as Req;
    if (!body?.type) {
      return new Response(JSON.stringify({ error: "Missing 'type'" }), {
        status: 400, headers: { "content-type": "application/json", ...cors(req) },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
      global: { headers: { Authorization: req.headers.get("Authorization")! } },
    });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "content-type": "application/json", ...cors(req) },
    });

    const { data: profile } = await supabase
      .from(TABLE_PROFILE)
      .select("plan:app_plans(code,features)")
      .eq("user_id", user.id)
      .single();

    const f = profile?.plan?.features as any;
    if (!f) return new Response(JSON.stringify({ error: "No features" }), {
      status: 400, headers: { "content-type": "application/json", ...cors(req) },
    });

    const capBrand   = f.brands_max ?? -1;
    const capProd    = f.products_per_brand_max ?? -1;
    const capAvatars = f.avatars_max ?? -1;
    const capBrandBgs = f.brand_bgs_max ?? -1;


    if (body.type === "brand") {
      if (typeof capBrand === "number" && capBrand >= 0) {
        const { count } = await supabase
          .from(T_BRANDS).select("*", { count: "exact", head: true })
          .eq("user_id", user.id);
        const remaining = Math.max(0, capBrand - (count ?? 0));
        return new Response(
          JSON.stringify({ allowed: remaining > 0, remaining }),
          { status: 200, headers: { "content-type": "application/json", ...cors(req) } }
        );
      }
      return new Response(JSON.stringify({ allowed: true, remaining: Infinity }), {
        status: 200, headers: { "content-type": "application/json", ...cors(req) },
      });
    }

    if (body.type === "product") {
      if (!body.brandId) {
        return new Response(JSON.stringify({ error: "brandId required for product" }), {
          status: 400, headers: { "content-type": "application/json", ...cors(req) },
        });
      }
      if (typeof capProd === "number" && capProd >= 0) {
        const { count } = await supabase
          .from(T_PRODUCTS).select("*", { count: "exact", head: true })
          .eq("brand_id", body.brandId).eq("user_id", user.id);
        const remaining = Math.max(0, capProd - (count ?? 0));
        return new Response(
          JSON.stringify({ allowed: remaining > 0, remaining }),
          { status: 200, headers: { "content-type": "application/json", ...cors(req) } }
        );
      }
      return new Response(JSON.stringify({ allowed: true, remaining: Infinity }), {
        status: 200, headers: { "content-type": "application/json", ...cors(req) },
      });
    }

    if (body.type === "avatar") {
      if (typeof capAvatars === "number" && capAvatars >= 0) {
        const { count } = await supabase
          .from(T_AVATARS).select("*", { count: "exact", head: true })
          .eq("user_id", user.id);
        const remaining = Math.max(0, capAvatars - (count ?? 0));
        return new Response(
          JSON.stringify({ allowed: remaining > 0, remaining }),
          { status: 200, headers: { "content-type": "application/json", ...cors(req) } }
        );
      }
      return new Response(JSON.stringify({ allowed: true, remaining: Infinity }), {
        status: 200, headers: { "content-type": "application/json", ...cors(req) },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown type" }), {
      status: 400, headers: { "content-type": "application/json", ...cors(req) },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: "Server error" }), {
      status: 500, headers: { "content-type": "application/json", ...cors(req) },
    });
  }
});
