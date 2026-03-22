// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const STRIPE_SECRET = Deno.env.get("STRIPE_SECRET_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function cors(req: Request) {
  const origin = req.headers.get("Origin") || "*";

  return {
    "access-control-allow-origin": origin,
    "access-control-allow-credentials": "true",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers":
      req.headers.get("Access-Control-Request-Headers") ??
      "authorization, x-client-info, apikey, content-type",
    vary: "Origin, Access-Control-Request-Headers",
    "content-type": "application/json",
  };
}

function send(req: Request, body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: cors(req),
  });
}

export default {
  async fetch(req: Request) {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: cors(req) });
    }

    if (req.method !== "POST") {
      return send(req, { error: "Method not allowed" }, 405);
    }

    try {
      const auth = req.headers.get("Authorization") || "";

      const supabaseUser = createClient(SUPABASE_URL, SUPABASE_ANON, {
        global: { headers: { Authorization: auth } },
      });

      const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE);

      const {
        data: { user },
      } = await supabaseUser.auth.getUser();

      if (!user) return send(req, { error: "Not authenticated" }, 401);

      const { data: profile } = await supabaseUser
        .from("profiles")
        .select("stripe_subscription_id")
        .eq("id", user.id)
        .single();

      if (!profile?.stripe_subscription_id) {
        return send(req, { error: "No subscription found" }, 400);
      }

      // 🔥 RESUME SUB (remove cancel)
      const form = new URLSearchParams();
      form.set("cancel_at_period_end", "false");

      const stripeRes = await fetch(
        `https://api.stripe.com/v1/subscriptions/${profile.stripe_subscription_id}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${STRIPE_SECRET}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: form,
        }
      );

      const stripeData = await stripeRes.json();

      if (!stripeRes.ok) {
        throw new Error(stripeData.error?.message || "Stripe error");
      }

      // 🔥 UPDATE SUPABASE
      await supabaseAdmin
        .from("profiles")
        .update({
          cancel_at_period_end: false,
          stripe_subscription_status: stripeData.status,
        })
        .eq("id", user.id);

      return send(req, { success: true });
    } catch (e: any) {
      return send(req, { error: e.message }, 500);
    }
  },
};