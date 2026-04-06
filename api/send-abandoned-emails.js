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

function emailOneHtml() {
  return `
  <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:20px;color:#111;">
    <p>Hey,</p>

    <p>Quick question — did something break when you were setting up Zyvo?</p>

    <p>Most people who stop here usually hit:</p>

    <p>
    • something didn’t load<br>
    • or it wasn’t clear what to do next
    </p>

    <p>
      <a href="https://tryzyvo.com/workspace/pricing" 
         style="padding:10px 16px;background:#6C3BFF;color:white;border-radius:8px;text-decoration:none;font-weight:600;">
         Continue setup →
      </a>
    </p>

    <p>If anything felt off, just reply — I’ll fix it.</p>

    <p>— Niko</p>
  </div>
  `;
}

function emailTwoHtml() {
  return `
  <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:20px;color:#111;">
    <p>Hey,</p>

    <p>You were literally <b>one step away</b>.</p>

    <p>
    • start posting and growing<br>
    • or never come back
    </p>

    <p>
      <a href="https://tryzyvo.com/workspace/pricing"
         style="padding:10px 16px;background:#6C3BFF;color:white;border-radius:8px;text-decoration:none;font-weight:600;">
         Finish setup →
      </a>
    </p>

    <p>— Niko</p>
  </div>
  `;
}

function emailThreeHtml() {
  return `
  <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:20px;color:#111;">
    <p>Hey,</p>

    <p>I’ll stop after this 👍</p>

    <p>
      <a href="https://tryzyvo.com/workspace/pricing"
         style="padding:10px 16px;background:#6C3BFF;color:white;border-radius:8px;text-decoration:none;font-weight:600;">
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

  if (!html) return;

  // check still unpaid
  const { data: stillUser } = await supabase
    .from("abandoned_checkouts")
    .select("paid")
    .eq("id", user.id)
    .single();

  if (stillUser?.paid) return;

  const { error } = await resend.emails.send({
    from: "Niko from Zyvo <niko@tryzyvo.com>",
    to: user.email,
    subject,
    html,
    reply_to: "niko@tryzyvo.com",
  });

  if (error) {
    console.error("❌ SEND ERROR:", error);
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

  console.log("✅ Sent:", user.email);
}

// ==============================
// MAIN HANDLER
// ==============================

export default async function handler(req, res) {
  console.log("🔥 EMAIL CRON TRIGGERED");

  try {
    const { data: users } = await supabase
      .from("abandoned_checkouts")
      .select("*")
      .eq("paid", false)
      .in("status", ["pending", "in_sequence"])
      .lt("recovery_stage", 3);

    console.log("📊 USERS:", users?.length);

    // 🔥 LOAD ALL PROFILES (NO LIMIT)
    let allProfiles = [];
    let from = 0;
    const batchSize = 1000;

    while (true) {
      const { data } = await supabase
        .from("profiles")
        .select("email, email_updates")
        .range(from, from + batchSize - 1);

      if (!data || data.length === 0) break;

      allProfiles.push(...data);
      from += batchSize;
    }

    console.log("📊 TOTAL PROFILES:", allProfiles.length);

    const profileMap = new Map(
      allProfiles.map(p => [
        p.email?.toLowerCase().trim(),
        p.email_updates
      ])
    );

    const now = Date.now();

    for (const user of users) {
      if (!user.email) continue;

      const normalizedEmail = user.email.toLowerCase().trim();
      const consent = profileMap.get(normalizedEmail);

      // ✅ ONLY skip if explicitly false
      if (consent === false) {
        console.log("⛔ opted out:", user.email);
        continue;
      }

      const createdAt = new Date(user.created_at).getTime();
      const lastSent = user.last_email_sent_at
        ? new Date(user.last_email_sent_at).getTime()
        : 0;

      const shouldSendStage1 =
        user.recovery_stage === 0 &&
        now - createdAt >= 10 * 60 * 1000;

      const shouldSendStage2 =
        user.recovery_stage === 1 &&
        lastSent &&
        now - lastSent >= 60 * 60 * 1000;

      const shouldSendStage3 =
        user.recovery_stage === 2 &&
        lastSent &&
        now - lastSent >= 24 * 60 * 60 * 1000;

      if (shouldSendStage1 || shouldSendStage2 || shouldSendStage3) {
        console.log("🚀 Sending:", user.email);
        await sendStageEmail(user);

        await new Promise(r =>
          setTimeout(r, 800 + Math.random() * 800)
        );
      }
    }

    console.log("✅ CRON DONE");

    return res.status(200).json({ success: true });

  } catch (err) {
    console.error("❌ handler error:", err);
    return res.status(500).json({ error: "Internal error" });
  }
}