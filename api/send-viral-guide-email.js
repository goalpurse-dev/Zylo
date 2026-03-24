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

const DELAY_MS = 400;
const DRY_RUN = false;

/* ================= HELPERS ================= */

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* ================= EMAIL ================= */

function viralEmailHtml(user) {
  const name = user.email?.split("@")[0] || "creator";

  return `
  <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:20px;color:#111;line-height:1.6;">
    
    <p style="font-size:18px;">Hey ${name},</p>

    <p style="font-size:20px;">
      <strong>This is how people are going viral with Zyvo right now 👇</strong>
    </p>

    <p>
      Not longer videos.
      <br/>
      Not complicated edits.
    </p>

    <p>
      Just this simple method:
    </p>

    <hr/>

    <p><strong>1. Create multiple short clips (5–10s)</strong></p>
    <p>
      Each clip = one moment.
      <br/>
      Fast, engaging, no boring parts.
    </p>

    <p><strong>2. Use the SAME reference image every time</strong></p>
    <p>
      This keeps your character consistent.
      <br/>
      (this is what most people miss)
    </p>

    <p><strong>3. Stitch them together in CapCut</strong></p>
    <p>
      Now it looks like one full viral video.
    </p>

    <p><strong>4. Add captions + sound → done</strong></p>

    <hr/>

    <p style="font-size:18px;">
      That’s literally it.
    </p>

    <p>
      This is how people are hitting views right now.
    </p>

    <p style="margin-top:20px;">
      👉 
      <a href="https://tryzyvo.com/workspace/video-generator" 
         style="background:#000;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;">
        Try it yourself
      </a>
    </p>

    <p style="margin-top:25px;">
      Don’t overthink it.
      <br/>
      Just start creating.
    </p>

    <p style="margin-top:30px;">— Zyvo</p>

  </div>
  `;
}

/* ================= MAIN ================= */

export default async function handler(req, res) {
  try {
    console.log("🚀 Starting VIRAL GUIDE email campaign...");

    const { data: users, error } = await supabase
      .from("profiles")
      .select("email")
      .eq("email_updates", true);

    if (error) {
      console.error("❌ Supabase error:", error);
      return res.status(500).json({ error: "Failed to fetch users" });
    }

    console.log(`📊 Total users: ${users.length}`);

    let sent = 0;
    let failed = 0;

    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      if (!user.email) continue;

      try {
        if (DRY_RUN) {
          console.log(`🧪 ${user.email}`);
        } else {
          await resend.emails.send({
            from: "Zyvo <updates@tryzyvo.com>",
            to: user.email,
            subject: "How to go viral with Zyvo (nobody tells you this)",
            html: viralEmailHtml(user),
          });

          sent++;
          console.log(`✅ Sent (${i + 1}/${users.length}): ${user.email}`);
        }

      } catch (err) {
        failed++;
        console.error(`❌ Failed: ${user.email}`);
      }

      await sleep(DELAY_MS);
    }

    console.log("🎯 Done");
    console.log(`✅ Sent: ${sent}`);
    console.log(`❌ Failed: ${failed}`);

    return res.status(200).json({
      success: true,
      sent,
      failed,
    });

  } catch (err) {
    console.error("🔥 Error:", err);
    return res.status(500).json({ error: "Unexpected error" });
  }
}

/* ================= LOCAL RUN ================= */

if (process.argv[1]?.includes("send-viral-guide-email.js")) {
  console.log("🟢 Running script directly...");

  handler({}, {
    status: (code) => ({
      json: (data) => console.log("📤 Response:", code, data),
    }),
  });
}