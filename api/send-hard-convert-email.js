import dotenv from "dotenv";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local" });

const resend = new Resend(process.env.RESEND_API_KEY);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DELAY_MS = 3000;
const RETRY_DELAY_MS = 2000;
const MAX_SEND = 300;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function conversionHtml(user) {
  const name = user.email?.split("@")[0] || "there";

  return `
  <div style="font-family:Arial, sans-serif; max-width:520px; margin:auto; padding:20px; color:#111; line-height:1.6;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
      this is what most people get wrong
    </div>

    <p>Hey ${name},</p>

    <p>I’ve been watching how people use Zyvo.</p>

    <p>There’s a pattern.</p>

    <p>Some users generate 5–10 images and stop.</p>

    <p>Others generate <strong>50+ variations</strong> and suddenly one hits.</p>

    <p><strong>Same tool. Different results.</strong></p>

    <p>The difference isn’t skill.</p>

    <p>It’s volume.</p>

    <hr style="margin:20px 0; border:none; border-top:1px solid #eee;" />

    <p>That’s why most serious users move to Pro.</p>

    <p>Not for features, but because they can actually test ideas properly.</p>

    <p>Right now it’s also <strong>25% off</strong> (€32 → €24.99)</p>

    <div style="margin:22px 0;">
      <a href="https://tryzyvo.com/workspace/pricing">
        see plans →
      </a>
    </div>

    <p>Once you start generating more, things start to click.</p>

    <p>— Zyvo</p>
  </div>
  `;
}

async function sendEmail(user) {
  const subject = "most people use this wrong";

  let sendError = null;

  for (let attempt = 1; attempt <= 2; attempt++) {
    const { error } = await resend.emails.send({
      from: "Zyvo <niko@tryzyvo.com>",
      to: user.email,
      subject,
      html: conversionHtml(user),
    });

    if (!error) {
      sendError = null;
      break;
    }

    sendError = error;
    await sleep(RETRY_DELAY_MS);
  }

  if (sendError) return false;
  return true;
}

export default async function handler(req, res) {
  try {
    console.log("🚀 Starting conversion email...");

    let allUsers = [];
    let from = 0;
    const batchSize = 1000;

    while (true) {
      const { data, error } = await supabase
        .from("profiles")
        .select("email, email_updates, last_email_sent_at")
        .eq("email_updates", true)
        .range(from, from + batchSize - 1);

      if (error) {
        console.error(error);
        return res.status(500).json({ error: "fetch error" });
      }

      if (!data || data.length === 0) break;

      allUsers.push(...data);

      if (data.length < batchSize) break;
      from += batchSize;
    }

    let sent = 0;
    let skipped = 0;
    let processed = 0;

    for (const user of allUsers) {
      if (processed >= MAX_SEND) break;
      if (!user.email) continue;

      if (user.last_email_sent_at) {
        skipped++;
        continue;
      }

      console.log(`➡️ Sending to: ${user.email}`);

      const ok = await sendEmail(user);

      if (ok) {
        sent++;

        await supabase
          .from("profiles")
          .update({
            last_email_sent_at: new Date().toISOString(),
          })
          .eq("email", user.email);
      }

      processed++;
      await sleep(DELAY_MS);
    }

    console.log(`✅ Sent: ${sent}`);
    console.log(`⏭️ Skipped: ${skipped}`);

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "internal error" });
  }
}

handler(
  {},
  {
    status: () => ({
      json: (data) => console.log("📤", data),
    }),
  }
);