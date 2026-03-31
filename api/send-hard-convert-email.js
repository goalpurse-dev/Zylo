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

function hardConvertHtml(user) {
  const name = user.email?.split("@")[0] || "there";

  return `
  <div style="font-family:Arial, sans-serif; max-width:520px; margin:auto; padding:20px; color:#111; line-height:1.6;">
    
    <!-- preview text -->
    <div style="display:none; max-height:0; overflow:hidden;">
      Nano Banana 2 is on another level
    </div>

    <p>Hey ${name},</p>

    <p>
      not even exaggerating —
    </p>

    <p>
      <strong>Nano Banana 2 is on another level.</strong>
    </p>

    <p>
      the quality jump compared to older models is obvious the moment you generate.
    </p>

    <p>
      cleaner outputs.<br>
      more “viral-looking” images.<br>
      way more usable results instantly.
    </p>

    <p>
      and this is what people are already using to make content right now.
    </p>

    <p>
      the difference isn’t talent.<br>
      it’s just volume + better outputs.
    </p>

    <p>
      most users stay on free → generate a few things → stop.
    </p>

    <p>
      the ones getting results are generating <strong>consistently</strong>.
    </p>

    <p>
      on Pro, you can generate <strong>200+ Nano Banana 2 images</strong>.
    </p>

    <p>
      that’s enough to actually test ideas, improve, and post daily.
    </p>

    <p>
      <a href="https://tryzyvo.com/workspace/pricing">
        upgrade and try it →
      </a>
    </p>

    <p>
      once you see the difference, you’ll get it instantly.
    </p>

    <p>— Zyvo</p>

  </div>
  `;
}

async function sendEmail(user) {
  const subject = "🍌 this is actually insane";

  let sendError = null;

  for (let attempt = 1; attempt <= 2; attempt++) {
    const { error } = await resend.emails.send({
      from: "Zyvo <niko@tryzyvo.com>",
      to: user.email,
      subject,
      html: hardConvertHtml(user),
      reply_to: "niko@tryzyvo.com",
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
    console.log("🚀 Starting hard convert email...");

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
if (process.argv[1]?.includes("send-hard-convert-email.js")) {
  console.log("🟢 Running hard convert email...");

  handler(
    {},
    {
      status: (code) => ({
        json: (data) => console.log("📤 Response:", code, data),
      }),
    }
  );
}