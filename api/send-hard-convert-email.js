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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function whatWorksHtml(user) {
  const name = user.email?.split("@")[0] || "there";

  return `
  <div style="font-family:Arial, sans-serif; max-width:520px; margin:auto; padding:20px; color:#111; line-height:1.6;">
    
    <!-- CLEAN PREVIEW -->
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
      what’s actually working right now
    </div>

    <p>Hey ${name},</p>

    <p>
      quick thing I’ve been noticing from people using Zyvo:
    </p>

    <p>
      the ones getting views aren’t doing anything crazy.
    </p>

    <p>
      they’re just:
    </p>

    <p>
      • testing multiple ideas<br>
      • generating more content<br>
      • posting consistently
    </p>

    <p>
      that’s literally it.
    </p>

    <p>
      the biggest mistake is trying one idea, not seeing results, and stopping.
    </p>

    <p>
      the people who keep generating and trying different styles eventually hit something that works.
    </p>

    <p>
      and once one video works, everything changes.
    </p>

    <p>
      if you’re using Zyvo, try this:
    </p>

    <p>
      generate 5–10 variations of the same idea and compare them.
    </p>

    <p>
      you’ll see very quickly what stands out more.
    </p>

    <p>
      curious what you’re working on btw — reply if you’re building something
    </p>

    <p>
      — Zyvo
    </p>

  </div>
  `;
}

async function sendEmail(user) {
  const subject = "what's actually working right now";

  let sendError = null;

  for (let attempt = 1; attempt <= 2; attempt++) {
    const { error } = await resend.emails.send({
      from: "Zyvo <niko@tryzyvo.com>",
      to: user.email,
      subject,
      html: whatWorksHtml(user),
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
    console.log("🚀 Starting 'what works' email...");

    const { data: users, error } = await supabase
      .from("profiles")
      .select("email");

    if (error) {
      console.error("❌ Supabase error:", error);
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

      if (ok) sent++;
      else failed++;

      await sleep(DELAY_MS);
    }

    console.log("🎯 Done");
    console.log(`✅ Sent: ${sent}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⚠️ Skipped: ${skipped}`);

    return res.status(200).json({
      success: true,
      total: users.length,
      sent,
      failed,
      skipped,
    });

  } catch (err) {
    console.error("🔥 Error:", err);
    return res.status(500).json({ error: "Internal error" });
  }
}

// LOCAL RUN
console.log("🟢 Running 'what works' email...");

handler(
  {},
  {
    status: (code) => ({
      json: (data) => console.log("📤 Response:", code, data),
    }),
  }
);