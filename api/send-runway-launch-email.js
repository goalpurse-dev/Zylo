import dotenv from "dotenv";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local" });

const resend = new Resend(process.env.RESEND_API_KEY);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/* ================= CONFIG ================= */

const DELAY_MS = 400; // delay between emails (safe: 300–800ms)
const DRY_RUN = false; // set true to test without sending

/* ================= HELPERS ================= */

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* ================= EMAIL HTML ================= */

function runwayEmailHtml(user) {
  const name = user.email?.split("@")[0] || "creator";

  return `
  <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:20px;color:#111;line-height:1.6;">
    
    <p style="font-size:18px;">Hey ${name},</p>

    <p><strong>Runway Gen-4 Turbo just dropped.</strong></p>

    <p>This changes everything about AI video.</p>

    <ul>
      <li>⚡ Faster than anything we’ve had</li>
      <li>🎬 Cinematic-level output</li>
      <li>🔥 Actually looks like viral content</li>
    </ul>

    <p><strong>Almost nobody is using this yet.</strong></p>

    <p>
      Which means right now you can create content that stands out instantly.
    </p>

    <p>
      Once everyone catches on… it’s already too late.
    </p>

    <p style="margin-top:25px;">
      👉 
      <a href="https://tryzyvo.com/workspace/video-generator" 
         style="background:#000;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;">
        Try it now
      </a>
    </p>

    <p style="margin-top:30px;">— Zyvo</p>

  </div>
  `;
}

/* ================= MAIN HANDLER ================= */

export default async function handler(req, res) {
  try {
    console.log("🚀 Starting Runway email campaign...");

    const { data: users, error } = await supabase
      .from("profiles")
      .select("email")
      .eq("email_updates", true);

    if (error) {
      console.error("❌ Supabase fetch error:", error);
      return res.status(500).json({ error: "Failed to fetch users" });
    }

    console.log(`📊 Total users to send: ${users.length}`);

    let sent = 0;
    let failed = 0;

    for (let i = 0; i < users.length; i++) {
      const user = users[i];

      if (!user.email) continue;

      try {
        if (DRY_RUN) {
          console.log(`🧪 [DRY RUN] Would send to: ${user.email}`);
        } else {
          await resend.emails.send({
            from: "Zyvo <updates@tryzyvo.com>",
            to: user.email,
            subject: "Runway Gen-4 Turbo just dropped (you’re early)",
            html: runwayEmailHtml(user),
          });

          sent++;
          console.log(`✅ Sent (${i + 1}/${users.length}): ${user.email}`);
        }

      } catch (err) {
        failed++;
        console.error(`❌ Failed: ${user.email}`, err);
      }

      // Delay to avoid rate limits
      await sleep(DELAY_MS);
    }

    console.log("🎯 Campaign finished");
    console.log(`✅ Sent: ${sent}`);
    console.log(`❌ Failed: ${failed}`);

    return res.status(200).json({
      success: true,
      total: users.length,
      sent,
      failed,
    });

  } catch (err) {
    console.error("🔥 Unexpected error:", err);
    return res.status(500).json({ error: "Unexpected error" });
  }
} // ✅ CLOSE HANDLER HERE




/* ================= LOCAL RUN (FIXED) ================= */

if (process.argv[1]?.includes("send-runway-launch-email.js")) {
  console.log("🟢 Running script directly...");

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