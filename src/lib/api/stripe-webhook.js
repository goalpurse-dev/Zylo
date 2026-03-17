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
  api: {
    bodyParser: false,
  },
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
    console.error("❌ Webhook signature error:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    const obj = event.data.object;

    // ==============================
    // 🔴 CHECKOUT EXPIRED
    // ==============================
    if (event.type === "checkout.session.expired") {
      const session = obj;

      const email =
        session.customer_details?.email ||
        session.customer_email ||
        null;

      if (!email) {
        console.log("⚠️ Expired session without email");
        return res.status(200).json({ received: true });
      }

      const { error } = await supabase
        .from("abandoned_checkouts")
        .upsert(
          {
            email,
            stripe_session_id: session.id,
            stripe_customer_id: session.customer || null,
            status: "pending",
            recovery_stage: 0,
            recovered: false,
            paid: false,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "email" }
        )
        .select();

      if (error) {
        console.error("❌ Error on expired checkout:", error);
      } else {
        console.log("🟡 Checkout expired:", email);
      }
    }

    // ==============================
    // 🟢 PAYMENT COMPLETED
    // ==============================
    if (event.type === "checkout.session.completed") {
      const session = obj;

      const email =
        session.customer_details?.email ||
        session.customer_email ||
        null;

      if (!email) {
        console.log("⚠️ Completed session without email");
        return res.status(200).json({ received: true });
      }

      const { error } = await supabase
        .from("abandoned_checkouts")
        .update({
          paid: true,
          recovered: true,
          status: "converted",
          updated_at: new Date().toISOString(),
        })
        .eq("email", email);

      if (error) {
        console.error("❌ Error updating conversion:", error);
      } else {
        console.log("💰 Converted:", email);
      }
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error("❌ Webhook handler error:", err);
    return res.status(500).json({ error: "Webhook failed" });
  }
}