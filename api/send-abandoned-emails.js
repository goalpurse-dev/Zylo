import dotenv from "dotenv";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local" });

const resend = new Resend(process.env.RESEND_API_KEY);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function emailOneHtml(user) {
  return `
  <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:20px;color:#111;line-height:1.6;">
    
    <p>Hey,</p>

    <p>I saw you were setting up Zyvo but didn’t finish.</p>

    <p>Most people quit here — but this is actually the part where things start working.</p>

    <p>You’re already in. Just finish it:</p>

    <p>
      <a href="https://tryzyvo.com/workspace/pricing">
        https://tryzyvo.com/workspace/pricing
      </a>
    </p>

    <p>If something broke or felt confusing, just reply — I read everything.</p>

    <p>— Niko</p>

  </div>
  `;
}

function emailTwoHtml(user) {
  return `
  <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:20px;color:#111;line-height:1.6;">
    
    <p>Hey,</p>

    <p>Quick thing I’ve noticed:</p>

    <p>The people who actually use Zyvo consistently are the ones who start posting more, testing faster, and growing faster.</p>

    <p>Everyone else just signs up… and never uses it.</p>

    <p>You were already halfway there.</p>

    <p>
      <a href="https://tryzyvo.com/workspace/pricing">
        Finish setup here
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

    <p>I’ll leave this here and won’t send anything else after this.</p>

    <p>If you still want to use Zyvo to create content faster, now’s the moment.</p>

    <p>
      <a href="https://tryzyvo.com/workspace/pricing">
        Continue your setup
      </a>
    </p>

    <p>If not, all good 👍</p>

    <p>— Niko</p>

  </div>
  `;
}
async function sendStageEmail(user) {
  let subject = "";
  let html = "";

  if (user.recovery_stage === 0) {
    subject = "quick question"
    html = emailOneHtml(user);
  }
  else if (user.recovery_stage === 1) {
    subject = "most people never do this"
    html = emailTwoHtml(user);
  }
  else if (user.recovery_stage === 2) {
    subject = "I’ll stop after this"
    html = emailThreeHtml(user);
  }

  if (!html) return;

  const { error } = await resend.emails.send({
    from: "Niko <niko@tryzyvo.com>",
    to: user.email,
    subject,
    html,
  });

  if (error) {
    console.error("Resend error:", user.email, error);
    return;
  }

  const { error: updateError } = await supabase
    .from("abandoned_checkouts")
    .update({
      recovery_stage: user.recovery_stage + 1,
      last_email_sent_at: new Date().toISOString(),
      status: user.recovery_stage + 1 >= 3 ? "finished" : "in_sequence",
    })
    .eq("id", user.id);

  if (updateError) {
    console.error("Supabase update error:", user.email, updateError);
  } else {
    console.log(`Sent stage ${user.recovery_stage + 1} to ${user.email}`);
  }
}

export default async function handler(req, res) {
  try {
    const { data: users, error } = await supabase
      .from("abandoned_checkouts")
      .select("*")
      .eq("paid", false)
      .in("status", ["pending", "in_sequence"])
      .lt("recovery_stage", 3);

    if (error) {
      console.error(error);
      return res.status(500).json({ error: "Failed to fetch users" });
    }

    const now = Date.now();

    for (const user of users) {
      const createdAt = new Date(user.created_at).getTime();
      const lastSent = user.last_email_sent_at
        ? new Date(user.last_email_sent_at).getTime()
        : null;

      const shouldSendStage1 =
        user.recovery_stage === 0 &&
        now - createdAt >= 30 * 60 * 1000

      const shouldSendStage2 =
        user.recovery_stage === 1 &&
        lastSent &&
        now - lastSent >= 24 * 60 * 60 * 1000;

      const shouldSendStage3 =
        user.recovery_stage === 2 &&
        lastSent &&
        now - lastSent >= 48 * 60 * 60 * 1000;

      if (shouldSendStage1 || shouldSendStage2 || shouldSendStage3) {
        await sendStageEmail(user);
        await new Promise((r) => setTimeout(r, 1200));
      }
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("send-abandoned-emails error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}