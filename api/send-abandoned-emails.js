import dotenv from "dotenv";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local" });

const resend = new Resend(process.env.RESEND_API_KEY);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ==============================
// EMAIL TEMPLATES
// ==============================

function emailOneHtml(user) {
  return `
  <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:20px;color:#111;line-height:1.6;">
    <p>Hey,</p>

    <p>Quick question — did something break when you were setting up Zyvo?</p>

    <p>Most people who stop here usually hit:</p>

    <p>
    • something didn’t load<br>
    • or it wasn’t clear what to do next
    </p>

    <p>
      <a href="https://tryzyvo.com/workspace/pricing" 
         style="display:inline-block;padding:10px 16px;background:#6C3BFF;color:white;border-radius:8px;text-decoration:none;font-weight:600;">
         Continue setup →
      </a>
    </p>

    <p>If anything felt off, just reply — I’ll fix it.</p>

    <p>— Niko</p>
  </div>
  `;
}

function emailTwoHtml(user) {
  return `
  <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:20px;color:#111;line-height:1.6;">
    <p>Hey,</p>

    <p>You were literally <b>one step away</b>.</p>

    <p>This is where people either:</p>

    <p>
    • start posting and growing<br>
    • or never come back
    </p>

    <p>
      <a href="https://tryzyvo.com/workspace/pricing"
         style="display:inline-block;padding:10px 16px;background:#6C3BFF;color:white;border-radius:8px;text-decoration:none;font-weight:600;">
         Finish setup →
      </a>
    </p>

    <p>— Niko</p>
  </div>
  `;
}

function emailThreeHtml(user) {
  return `
  <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:20px;color:#111;line-height:1.6;">
    <p>Hey,</p>

    <p>I’ll stop after this 👍</p>

    <p>If you still want to create content faster, you can continue here:</p>

    <p>
      <a href="https://tryzyvo.com/workspace/pricing"
         style="display:inline-block;padding:10px 16px;background:#6C3BFF;color:white;border-radius:8px;text-decoration:none;font-weight:600;">
         Continue →
      </a>
    </p>

    <p>— Niko</p>
  </div>
  `;
}

// ==============================
// SEND EMAIL
// ==============================

async function sendStageEmail(user) {
  console.log("📤 Preparing email:", user.email, "stage:", user.recovery_stage);

  let subject = "";
  let html = "";

  if (user.recovery_stage === 0) {
    subject = "did something break?";
    html = emailOneHtml();
  } else if (user.recovery_stage === 1) {
    subject = "you were 1 step away";
    html = emailTwoHtml();
  } else if (user.recovery_stage === 2) {
    subject = "should I stop?";
    html = emailThreeHtml();
  }

  if (!html) {
    console.log("⛔ No template");
    return;
  }

  // 🔥 DOUBLE CHECK STILL NOT PAID
  const { data: stillUser, error: fetchError } = await supabase
    .from("abandoned_checkouts")
    .select("paid")
    .eq("id", user.id)
    .single();

  if (fetchError || stillUser?.paid) {
    console.log("⛔ Skipping (already paid):", user.email);
    return;
  }

  // SEND
  let sendError = null;

  for (let attempt = 1; attempt <= 2; attempt++) {
    console.log(`📨 Sending attempt ${attempt} →`, user.email);

    const { error } = await resend.emails.send({
      from: "Niko from Zyvo <niko@tryzyvo.com>",
      to: user.email,
      subject,
      html,
      reply_to: "niko@tryzyvo.com",
    });

    if (!error) {
      console.log("✅ Email sent:", user.email);
      sendError = null;
      break;
    }

    sendError = error;
    console.log("⚠️ Retry failed:", error);
    await new Promise(r => setTimeout(r, 1500));
  }

  if (sendError) {
    console.error("❌ Final fail:", user.email, sendError);
    return;
  }

  await supabase
    .from("abandoned_checkouts")
    .update({
      recovery_stage: user.recovery_stage + 1,
      last_email_sent_at: new Date().toISOString(),
      status: user.recovery_stage + 1 >= 3 ? "finished" : "in_sequence",
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  console.log(`🚀 Stage updated → ${user.email}`);
}

// ==============================
// MAIN HANDLER
// ==============================

export default async function handler(req, res) {
  console.log("🔥 EMAIL CRON TRIGGERED");

  try {
    const { data: users, error } = await supabase
      .from("abandoned_checkouts")
      .select("*")
      .eq("paid", false)
      .in("status", ["pending", "in_sequence"])
      .lt("recovery_stage", 3);

    console.log("📊 USERS FOUND:", users?.length);

    if (error) {
      console.error("❌ FETCH ERROR:", error);
      return res.status(500).json({ error: "Fetch failed" });
    }

    const { data: profiles } = await supabase
      .from("profiles")
      .select("email, email_updates");

    console.log("📊 PROFILES LOADED:", profiles?.length);

    const profileMap = new Map(
      profiles.map(p => [p.email, p.email_updates])
    );

    const now = Date.now();

    for (const user of users) {
      console.log("➡️ Checking:", user.email);

      if (!user.email) {
        console.log("⚠️ No email → skip");
        continue;
      }

      const hasConsent = profileMap.get(user.email);
      console.log("📩 Consent:", hasConsent);

      if (!hasConsent) {
        console.log("⛔ No consent → skip");
        continue;
      }

      const createdAt = new Date(user.created_at).getTime();
      const lastSent = user.last_email_sent_at
        ? new Date(user.last_email_sent_at).getTime()
        : 0;

      console.log(
        "⏱️ Since created (min):",
        ((now - createdAt) / 60000).toFixed(2)
      );

      console.log(
        "⏱️ Since last email (min):",
        lastSent ? ((now - lastSent) / 60000).toFixed(2) : "never"
      );

      const shouldSendStage1 =
        user.recovery_stage === 0 &&
        now - createdAt >= 10 * 60 * 1000;

      const shouldSendStage2 =
        user.recovery_stage === 1 &&
        lastSent &&
        now - lastSent >= 6 * 60 * 60 * 1000;

      const shouldSendStage3 =
        user.recovery_stage === 2 &&
        lastSent &&
        now - lastSent >= 24 * 60 * 60 * 1000;

      if (shouldSendStage1 || shouldSendStage2 || shouldSendStage3) {
        console.log("🚀 SENDING:", user.email);
        await sendStageEmail(user);

        const delay = 1000 + Math.random() * 1000;
        await new Promise(r => setTimeout(r, delay));
      } else {
        console.log("⛔ Not ready:", user.email);
      }
    }

    console.log("✅ CRON FINISHED");

    return res.status(200).json({ success: true });

  } catch (err) {
    console.error("❌ handler error:", err);
    return res.status(500).json({ error: "Internal error" });
  }
}