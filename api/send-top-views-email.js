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

function topViewsHtml(user) {
  const name = user.email?.split("@")[0] || "there";

  return `
  <div style="font-family:Arial, sans-serif; max-width:520px; margin:auto; padding:20px; color:#111; line-height:1.6;">
    
    <!-- Preview text (important for inbox) -->
    <div style="display:none; max-height:0; overflow:hidden;">
      These videos blew up this week using Zyvo...
    </div>

    <p>Hey ${name},</p>

    <p>
      These were some of the top videos created with Zyvo this week:
    </p>

    <p>
      <strong>1. 2M views</strong><br>
      “AI chef cooking impossible meals”
    </p>

    <p>
      <strong>2. 800K views</strong><br>
      “POV: you enter a forbidden room”
    </p>

    <p>
      <strong>3. 400K views</strong><br>
      “This AI character feels too real…”
    </p>

    <p>
      All of these follow the same pattern:
    </p>

    <p>
      • short clips<br>
      • strong first frame<br>
      • consistent character<br>
      • simple editing (CapCut etc.)
    </p>

    <p>
      Nothing crazy — just done right.
    </p>

    <p>
      The difference is just starting and testing.
    </p>

    <p>
      <a href="https://tryzyvo.com/workspace/video-generator">
        Try creating one →
      </a>
    </p>

    <p>
      — Zyvo
    </p>

  </div>
  `;
}

async function sendEmail(user) {
  const subject = "these videos got millions…";

  let sendError = null;

  for (let attempt = 1; attempt <= 2; attempt++) {
    const { error } = await resend.emails.send({
      from: "Zyvo <updates@tryzyvo.com>",
      to: user.email,
      subject,
      html: topViewsHtml(user),
    });

    if (!error) {
      sendError = null;
      break;
    }

    sendError = error;
    console.error(`⚠️ Retry ${attempt} failed for ${user.email}`);
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
    console.log("🚀 Starting Top Views email...");

    const { data: users, error } = await supabase
      .from("profiles")
      .select("email, email_updates")
      .eq("email_updates", true);

    if (error) {
      console.error("❌ Supabase error:", error);
      return res.status(500).json({ error: "Failed to fetch users" });
    }

    console.log(`📊 Users: ${users.length}`);

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

      if (ok) sent++;
      else failed++;

      await sleep(DELAY_MS);
    }

    console.log("🎯 Done");
    console.log(`✅ Sent: ${sent}`);
    console.log(`❌ Failed: ${failed}`);

    return res.status(200).json({
      success: true,
      sent,
      failed,
      skipped,
    });

  } catch (err) {
    console.error("🔥 Error:", err);
    return res.status(500).json({ error: "Internal error" });
  }
}

// ================= LOCAL RUN =================
if (process.argv[1]?.includes("send-top-views-email.js")) {
  console.log("🟢 Running Top Views email...");

  handler(
    {},
    {
      status: (code) => ({
        json: (data) => console.log("📤 Response:", code, data),
      }),
    }
  );
}