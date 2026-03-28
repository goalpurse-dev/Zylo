import dotenv from "dotenv";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local" });

const resend = new Resend(process.env.RESEND_API_KEY);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DELAY_MS = 500;
const RETRY_DELAY_MS = 1500;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function followupHtml(user) {
  const name = user.email?.split("@")[0] || "there";

  return `
  <div style="font-family:Arial, sans-serif; max-width:520px; margin:auto; padding:20px; color:#111; line-height:1.6;">
    
    <p>Hey ${name},</p>

    <p>
      Quick one —
    </p>

    <p>
      did you try <strong>Nano Banana 2</strong> yet?
    </p>

    <p>
      A lot of people started using it right after the drop, and the difference in quality is pretty obvious.
    </p>

    <p>
      Especially for:
    </p>

    <p>
      • short-form content<br>
      • thumbnails<br>
      • viral-style edits
    </p>

    <p>
      It just looks better straight out of generation.
    </p>

    <p>
      And because it's cheap, you can actually test multiple ideas without worrying about credits.
    </p>

    <p>
      <a href="https://tryzyvo.com/workspace/image-generator">
        Try it here →
      </a>
    </p>

    <p>
      Curious what you think once you try it.
    </p>

    <p>— Niko</p>

  </div>
  `;
}

async function sendEmail(user) {
  const subject = "did you try this yet?";

  let sendError = null;

  for (let attempt = 1; attempt <= 2; attempt++) {
    const { error } = await resend.emails.send({
      from: "Zyvo <niko@tryzyvo.com>",
      to: user.email,
      subject,
      html: followupHtml(user),
      reply_to: "niko@tryzyvo.com",
    });

    if (!error) {
      sendError = null;
      break;
    }

    sendError = error;
    console.error(`⚠️ Retry ${attempt} failed for ${user.email}`, error);
    await sleep(RETRY_DELAY_MS);
  }

  if (sendError) {
    console.error("❌ Final fail:", user.email, sendError);
    return false;
  }

  return true;
}

export default async function handler(req, res) {
  try {
    console.log("🚀 Starting Nano Banana 2 follow-up...");

    const { data: users, error } = await supabase
      .from("profiles")
      .select("email, email_updates")
      .eq("email_updates", true);

    if (error) {
      console.error("❌ Supabase fetch error:", error);
      return res.status(500).json({ error: "Failed to fetch users" });
    }

    console.log(`📊 Total users: ${users.length}`);

    let sent = 0;
    let failed = 0;
    let skipped = 0;

    for (const user of users) {

      if (!user.email) {
        skipped++;
        continue;
      }

      console.log(`➡️ Sending to: ${user.email}`);

      const ok = await sendEmail(user);

      if (ok) {
        sent++;
      } else {
        failed++;
      }

      await sleep(DELAY_MS);
    }

    console.log("🎯 Follow-up finished");
    console.log(`✅ Sent: ${sent}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⚠️ Skipped: ${skipped}`);

    return res.status(200).json({
      success: true,
      sent,
      failed,
      skipped,
    });

  } catch (err) {
    console.error("🔥 Unexpected error:", err);
    return res.status(500).json({ error: "Unexpected error" });
  }
}

// ================= LOCAL RUN =================
if (process.argv[1]?.includes("send-nano-followup-email.js")) {
  console.log("🟢 Running follow-up email...");

  handler(
    {},
    {
      status: (code) => ({
        json: (data) => {
          console.log("📤 Response:", code, data);
        },
      }),
    }
  );
}