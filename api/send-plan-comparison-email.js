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

function comparisonHtml(user) {
  const name = user.email?.split("@")[0] || "there";

  return `
  <div style="font-family:Arial, sans-serif; max-width:520px; margin:auto; padding:20px; color:#111; line-height:1.6;">
    
    <!-- preview text -->
    <div style="display:none; max-height:0; overflow:hidden;">
      Starter or Pro? here's the real difference
    </div>

    <p>Hey ${name},</p>

    <p>
      quick one — a lot of people ask:
    </p>

    <p>
      <strong>“should I go with Starter or Pro?”</strong>
    </p>

    <hr style="margin:20px 0; border:none; border-top:1px solid #e5e7eb;" />

    <p><strong>Starter plan:</strong></p>

    <p>
      • 600 credits / month<br>
      • up to 200 images<br>
      • up to 30 AI videos<br>
      • standard speed<br>
      • 30 generations / day
    </p>

    <p>
      👉 good if you just want to test things out
    </p>

    <hr style="margin:20px 0; border:none; border-top:1px solid #e5e7eb;" />

    <p><strong>Pro plan:</strong></p>

    <p>
      • 1,200 credits / month<br>
      • up to 400 images<br>
      • up to 60 AI videos<br>
      • priority generation queue<br>
      • advanced prompt controls<br>
      • 100 generations / day
    </p>

    <p>
      👉 this is what most people switch to once they’re serious
    </p>

    <hr style="margin:20px 0; border:none; border-top:1px solid #e5e7eb;" />

    <p>
      the real difference isn’t just the numbers.
    </p>

    <p>
      it’s this:
    </p>

    <p>
      <strong>with Starter → you try a few things</strong><br>
      <strong>with Pro → you can actually improve and scale</strong>
    </p>

    <p>
      more generations = more testing = better content
    </p>

    <p>
      and that’s where results actually come from.
    </p>

    <div style="text-align:center; margin:28px 0;">
      <a href="https://tryzyvo.com/workspace/pricing"
         style="background:#111; color:#fff; padding:14px 22px; border-radius:10px; text-decoration:none; font-weight:700;">
        choose your plan →
      </a>
    </div>

    <p>
      if you’re planning to actually post consistently, Pro just makes it way easier.
    </p>

    <p>— Zyvo</p>

  </div>
  `;
}

async function sendEmail(user) {
  const subject = "starter or pro?";

  let sendError = null;

  for (let attempt = 1; attempt <= 2; attempt++) {
    const { error } = await resend.emails.send({
      from: "Zyvo <niko@tryzyvo.com>",
      to: user.email,
      subject,
      html: comparisonHtml(user),
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
    console.log("🚀 Starting plan comparison email...");

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

    console.log("🎯 Comparison email done");
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
if (process.argv[1]?.includes("send-plan-comparison-email.js")) {
  console.log("🟢 Running comparison email...");

  handler(
    {},
    {
      status: (code) => ({
        json: (data) => console.log("📤 Response:", code, data),
      }),
    }
  );
}