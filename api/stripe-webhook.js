import Stripe from "stripe";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local" });

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const config = {
  api: { bodyParser: false },
};

async function getRawBody(readable) {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed");
  }

  const sig = req.headers["stripe-signature"];
  let event;

  try {
    const rawBody = await getRawBody(req);
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("❌ Signature error:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    const obj = event.data.object;

    // =====================================================
    // 🟢 PAYMENT COMPLETED (MAIN LOGIC)
    // =====================================================
    if (event.type === "checkout.session.completed") {
      const session = obj;

      const email =
        session.customer_details?.email ||
        session.customer_email ||
        null;

      if (!email) {
        console.log("⚠️ No email on completed");
        return res.status(200).json({ received: true });
      }

      // 🔥 GET MOST RECENT UNPAID CHECKOUT
      const { data: rows, error: fetchError } = await supabase
        .from("abandoned_checkouts")
        .select("id")
        .eq("email", email)
        .eq("paid", false)
        .order("created_at", { ascending: false })
        .limit(1);

      if (fetchError) {
        console.error("❌ Fetch error:", fetchError);
        return res.status(200).json({ received: true });
      }

      if (rows?.length) {
        const { error: updateError } = await supabase
          .from("abandoned_checkouts")
          .update({
            paid: true,
            recovered: true,
            status: "converted",
            updated_at: new Date().toISOString(),
          })
          .eq("id", rows[0].id);

        if (updateError) {
          console.error("❌ Update error:", updateError);
        } else {
          console.log("💰 Converted:", email);
        }
      } else {
        console.log("⚠️ No matching unpaid checkout:", email);
      }
    }

    // =====================================================
    // 🔴 EXPIRED (LOG ONLY)
    // =====================================================
    if (event.type === "checkout.session.expired") {
      console.log("⌛ Expired:", obj.id);
    }

    // ✅ ALWAYS RETURN 200
    return res.status(200).json({ received: true });

  } catch (err) {
    console.error("❌ Webhook handler error:", err);

    // 🔥 NEVER RETURN 500 (prevents Stripe retry spam)
    return res.status(200).json({ received: true });
  }
}

