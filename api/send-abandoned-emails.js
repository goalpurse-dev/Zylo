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

    <p>Quick question — did something break when you were setting up Zyvo?</p>

    <p>I noticed you didn’t finish, which usually means either:</p>

    <p>• something was confusing<br>
    • or it didn’t load properly</p>

    <p>If you still want to continue, you can pick it up here:</p>

    <p>
      <a href="https://tryzyvo.com/workspace/pricing">
        Continue setup
      </a>
    </p>

    <p>If anything felt off, just reply — I’ll fix it for you.</p>

    <p>— Niko</p>

  </div>
  `;
}

function emailTwoHtml(user) {
  return `
  <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:20px;color:#111;line-height:1.6;">
    
    <p>Hey,</p>

    <p>I’ve been looking at how people use Zyvo, and there’s a clear pattern:</p>

    <p>The ones who actually finish setup start posting faster and getting results.</p>

    <p>The rest just sign up… and never use it.</p>

    <p>You were literally one step away.</p>

    <p>
      <a href="https://tryzyvo.com/workspace/pricing">
        Finish it here
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

    <p>If you still want to use Zyvo to create content faster, you can continue here:</p>

    <p>
      <a href="https://tryzyvo.com/workspace/pricing">
        Continue setup
      </a>
    </p>

    <p>If not, no worries at all.</p>

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
    subject = "you were one step away"
    html = emailTwoHtml(user);
  }
  else if (user.recovery_stage === 2) {
    subject = "should I stop?"
    html = emailThreeHtml(user);
  }

  if (!html) return;

  const { error } = await resend.emails.send({
  from: "Niko from Zyvo <niko@tryzyvo.com>",
  to: user.email,
  subject,
  html,
  reply_to: "niko@tryzyvo.com",
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
  .select(`
    *,
    profiles (email_updates)
  `)
  .eq("paid", false)
  .in("status", ["pending", "in_sequence"])
  .lt("recovery_stage", 3);

    if (error) {
      console.error(error);
      return res.status(500).json({ error: "Failed to fetch users" });
    }

    const now = Date.now();

   for (const user of users) {

  // 🔥 ADD THIS RIGHT HERE
  if (!user.profiles || !user.profiles.email_updates) {
  console.log("⛔ Skipping (no consent):", user.email);
  continue;
}

  const createdAt = new Date(user.created_at).getTime();
      const lastSent = user.last_email_sent_at
        ? new Date(user.last_email_sent_at).getTime()
        : null;

      const shouldSendStage1 =
  user.recovery_stage === 0 &&
  now - createdAt >= 30 * 60 * 1000 &&
  (!lastSent || now - lastSent >= 30 * 60 * 1000);

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
        const delay = 1500 + Math.random() * 1000;
await new Promise((r) => setTimeout(r, delay));
      }
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("send-abandoned-emails error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}