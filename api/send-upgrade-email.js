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

function upgradeHtml(user) {
  const name = user.email?.split("@")[0] || "there";

  return `
  <div style="font-family:Arial, sans-serif; max-width:520px; margin:auto; padding:20px; color:#111; line-height:1.6;">
    
    <!-- preview text -->
    <div style="display:none; max-height:0; overflow:hidden;">
      1-click viral videos are coming to Zyvo...
    </div>

    <p>Hey ${name},</p>

    <p>
      quick heads up —
    </p>

    <p>
      we’re building something new inside Zyvo:
    </p>

    <p>
      <strong>generate 1 minute+ viral videos with one click.</strong>
    </p>

    <p>
      no editing.<br>
      no stitching clips.<br>
      no setup.
    </p>

    <p>
      just one prompt → full viral-style video.
    </p>

    <p>
      we’re still working on it, but it’s coming soon.
    </p>

    <p>
      and the people already on a plan will be the first to use it properly.
    </p>

    <p>
      right now, most users:
    </p>

    <p>
      • don’t generate enough content<br>
      • don’t test enough ideas<br>
      • never actually scale
    </p>

    <p>
      that’s the difference.
    </p>

    <p>
      if you’re serious about growing with this, you need volume.
    </p>

    <p>
      <a href="https://tryzyvo.com/workspace/pricing">
        get access before it drops →
      </a>
    </p>

    <p>
      once this rolls out, the gap between casual users and people who actually post daily will get bigger.
    </p>

    <p>— Zyvo</p>

  </div>
  `;
}

async function sendEmail(user) {
  const subject = "you’ll want this before it drops";

  let sendError = null;

  for (let attempt = 1; attempt <= 2; attempt++) {
    const { error } = await resend.emails.send({
      from: "Zyvo <updates@tryzyvo.com>",
      to: user.email,
      subject,
      html: upgradeHtml(user),
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
    console.log("🚀 Starting upgrade trigger email...");

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
if (process.argv[1]?.includes("send-upgrade-email.js")) {
  console.log("🟢 Running upgrade email...");

  handler(
    {},
    {
      status: (code) => ({
        json: (data) => console.log("📤 Response:", code, data),
      }),
    }
  );
}