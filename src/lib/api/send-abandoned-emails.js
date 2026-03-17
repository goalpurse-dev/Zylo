import dotenv from "dotenv";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local" });

const resend = new Resend(process.env.RESEND_API_KEY);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function emailOneHtml() {
  return `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px;color:#111;">
      <p>Hey,</p>
      <p>You were really close to finishing your Zyvo setup.</p>
      <p>We recently added new video models that make content look way more cinematic and faster to create.</p>
      <p>You can continue here:</p>
      <p><a href="https://tryzyvo.com/workspace/pricing">https://tryzyvo.com/workspace/pricing</a></p>
      <p>— Niko<br/>Zyvo</p>
    </div>
  `;
}

function emailTwoHtml() {
  return `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px;color:#111;">
      <p>Hey,</p>
      <p>Just wanted to send a quick reminder in case you still wanted to try Zyvo.</p>
      <p>A lot of creators are using it for short-form content, product visuals, and faster content testing.</p>
      <p>If you want to finish setup, here’s the page:</p>
      <p><a href="https://tryzyvo.com/workspace/pricing">https://tryzyvo.com/workspace/pricing</a></p>
      <p>— Niko</p>
    </div>
  `;
}

function emailThreeHtml() {
  return `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px;color:#111;">
      <p>Hey,</p>
      <p>This is my last reminder.</p>
      <p>If you still want to get started with Zyvo, now’s a good time to jump in and test the new tools.</p>
      <p>You can continue here:</p>
      <p><a href="https://tryzyvo.com/workspace/pricing">https://tryzyvo.com/workspace/pricing</a></p>
      <p>— Niko</p>
    </div>
  `;
}

async function sendStageEmail(user) {
  let subject = "";
  let html = "";

  if (user.recovery_stage === 0) {
    subject = "quick question";
    html = emailOneHtml();
  } else if (user.recovery_stage === 1) {
    subject = "just checking in";
    html = emailTwoHtml();
  } else if (user.recovery_stage === 2) {
    subject = "last reminder";
    html = emailThreeHtml();
  } else {
    return;
  }

  const { error } = await resend.emails.send({
    from: "Zyvo <support@tryzyvo.com>",
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