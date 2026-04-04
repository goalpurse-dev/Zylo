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

function mostChooseProHtml(user) {
  const name = user.email?.split("@")[0] || "there";

  return `
  <div style="font-family:Arial, sans-serif; max-width:520px; margin:auto; padding:20px; color:#111; line-height:1.6;">
    
    <!-- preview text -->
    <div style="display:none; max-height:0; overflow:hidden;">
      most users end up choosing Pro
    </div>

    <p>Hey ${name},</p>

    <p>
      quick insight from what we’re seeing inside Zyvo:
    </p>

    <p>
      <strong>most people end up choosing Pro.</strong>
    </p>

    <p>
      not because it’s “more expensive”…
    </p>

    <p>
      but because after trying things a bit, they realize:
    </p>

    <p>
      they need more generations to actually make this work.
    </p>

    <hr style="margin:20px 0; border:none; border-top:1px solid #e5e7eb;" />

    <p>
      what usually happens:
    </p>

    <p>
      • they test a few ideas<br>
      • they start getting better outputs<br>
      • they want to post more consistently
    </p>

    <p>
      and then Starter just isn’t enough anymore.
    </p>

    <hr style="margin:20px 0; border:none; border-top:1px solid #e5e7eb;" />

    <p>
      with Pro you get:
    </p>

    <p>
      • 1,200 credits<br>
      • up to 400 images<br>
      • up to 60 AI videos<br>
      • priority generation speed<br>
      • 100 generations/day
    </p>

    <p>
      which basically means:
    </p>

    <p>
      <strong>you can actually create, test, and improve daily.</strong>
    </p>

    <p>
      that’s where the difference happens.
    </p>

    <div style="text-align:center; margin:28px 0;">
      <a href="https://tryzyvo.com/workspace/pricing"
         style="background:#111; color:#fff; padding:14px 22px; border-radius:10px; text-decoration:none; font-weight:700;">
        go with Pro →
      </a>
    </div>

    <p>
      just wanted to give you that context before you decide.
    </p>

    <p>— Zyvo</p>

  </div>
  `;
}

async function sendEmail(user) {
  const subject = "most people choose this";

  let sendError = null;

  for (let attempt = 1; attempt <= 2; attempt++) {
    const { error } = await resend.emails.send({
      from: "Zyvo <niko@tryzyvo.com>",
      to: user.email,
      subject,
      html: mostChooseProHtml(user),
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
    console.log("🚀 Starting 'most choose Pro' email...");

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

    for (const user of users) {

      if (!user.email) continue;

      console.log(`➡️ Sending to: ${user.email}`);

      const ok = await sendEmail(user);

      if (ok) sent++;
      else failed++;

      await sleep(DELAY_MS);
    }

    console.log("🎯 'Most choose Pro' email done");
    console.log(`✅ Sent: ${sent}`);
    console.log(`❌ Failed: ${failed}`);

    return res.status(200).json({
      success: true,
      sent,
      failed,
    });

  } catch (err) {
    console.error("🔥 Error:", err);
    return res.status(500).json({ error: "Internal error" });
  }
}

// ================= LOCAL RUN =================
if (process.argv[1]?.includes("send-most-choose-pro-email.js")) {
  console.log("🟢 Running 'most choose Pro' email...");

  handler(
    {},
    {
      status: (code) => ({
        json: (data) => console.log("📤 Response:", code, data),
      }),
    }
  );
}