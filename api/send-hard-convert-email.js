import dotenv from "dotenv";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local" });

const resend = new Resend(process.env.RESEND_API_KEY);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// 🔥 SAFE SETTINGS
const DELAY_MS = 3000;
const RETRY_DELAY_MS = 2000;
const MAX_SEND = 300;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function attemptEmailHtml(user) {
  const name = user.email?.split("@")[0] || "there";

  return `
  <div style="font-family:Arial, sans-serif; max-width:520px; margin:auto; padding:20px; color:#111; line-height:1.6;">
    
    <div style="display:none;max-height:0;overflow:hidden;">
      this took 6 tries to get right
    </div>

    <p>Hey ${name},</p>

    <p>I tested something quickly inside Zyvo.</p>

    <p>The first few generations?</p>

    <p>mid.</p>

    <p>Then around the 5th–6th try…</p>

    <p><strong>one output was actually good enough to post.</strong></p>

    <p>That’s when it clicked again:</p>

    <p><strong>this isn’t about one perfect prompt.</strong></p>

    <p>It’s about generating enough variations until something hits.</p>

    <hr style="margin:20px 0; border:none; border-top:1px solid #eee;" />

    <p>The people getting views aren’t smarter.</p>

    <p>They just run more attempts.</p>

    <p style="margin-top:20px;">
      <a href="https://tryzyvo.com/workspace/image-generator">
        try again here →
      </a>
    </p>

    <p style="margin-top:20px;">
      (this is also why most serious users end up on Pro — more credits = more chances)
    </p>

    <p>— Zyvo</p>

  </div>
  `;
}

async function sendEmail(user) {
  const subject = "this took 6 tries";

  let sendError = null;

  for (let attempt = 1; attempt <= 2; attempt++) {
    const { error } = await resend.emails.send({
      from: "Zyvo <updates@tryzyvo.com>", // ✅ NEW SENDER
      to: user.email,
      subject,
      html: attemptEmailHtml(user),
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
    console.log("🚀 Starting attempt email...");

    let allUsers = [];
    let from = 0;
    const batchSize = 1000;

    while (true) {
      const { data, error } = await supabase
        .from("profiles")
        .select("email, email_updates, last_email_type")
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

      // ✅ prevent duplicates
      if (user.last_email_type === "attempt_email") {
        skipped++;
        continue;
      }

      console.log(`➡️ Sending to: ${user.email}`);

      const ok = await sendEmail(user);

      if (ok) {
        sent++;
        processed++;

        await supabase
          .from("profiles")
          .update({
            last_email_type: "attempt_email"
          })
          .eq("email", user.email);
      }

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

// LOCAL RUN
handler(
  {},
  {
    status: () => ({
      json: (data) => console.log("📤", data),
    }),
  }
);