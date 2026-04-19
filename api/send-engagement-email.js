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

const DELAY_MS = 600;
const RETRY_DELAY_MS = 2000;
const BATCH_SIZE = 1000;
const MAX_SEND = 500;
const MIN_HOURS_SINCE_LAST_EMAIL = 0.5;
const DRY_RUN = false;

/* ================= HELPERS ================= */

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isEmaildTooRecently(lastSentAt) {
  if (!lastSentAt) return false;
  const hoursSince = (Date.now() - new Date(lastSentAt).getTime()) / 36e5;
  return hoursSince < MIN_HOURS_SINCE_LAST_EMAIL;
}

/* ================= EMAIL TEMPLATE ================= */

function engagementEmailHtml(user) {
  const name = user.email?.split("@")[0] || "there";

  return `
  <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px 20px;color:#111;line-height:1.7;">

    <!-- preview text (hidden) -->
    <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">
      what the creators actually posting are doing differently
    </div>

    <p>Hey ${name},</p>

    <p>
      noticed something interesting this week.
    </p>

    <p>
      the creators consistently posting AI content aren't
      doing anything special with their prompts.
    </p>

    <p>
      they just picked <strong>one format</strong> and stuck with it.
    </p>

    <hr style="border:none;border-top:1px solid #e5e5e5;margin:22px 0;" />

    <p><strong>Here's the exact format that's working right now:</strong></p>

    <p>
      → generate a short video clip with a bold claim in the caption<br />
      → same character, same vibe, every single time<br />
      → post it at 7am or 6pm (when your feed is dead)<br />
      → do it again tomorrow
    </p>

    <p>
      that's the whole strategy.
    </p>

    <p>
      most people overthink the content and underdo the volume.
    </p>

    <p>
      the ones getting traction just show up every day with something new.
    </p>

    <hr style="border:none;border-top:1px solid #e5e5e5;margin:22px 0;" />

    <p>
      if you haven't generated anything in a while — now's a good time.
    </p>

    <p style="margin-top:22px;">
      <a
        href="https://tryzyvo.com/workspace/video-generator"
        style="display:inline-block;background:#000;color:#fff;padding:13px 22px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;"
      >
        Create something today →
      </a>
    </p>

    <p style="margin-top:28px;color:#555;font-size:13px;">
      you're getting this because you opted in to Zyvo tips &amp; updates.<br />
      <a href="https://tryzyvo.com/settings" style="color:#888;">manage preferences</a>
    </p>

    <p style="margin-top:16px;">— Zyvo</p>

  </div>
  `;
}

/* ================= SEND WITH RETRY ================= */

async function sendEmail(user) {
  let lastError = null;

  for (let attempt = 1; attempt <= 2; attempt++) {
    const { error } = await resend.emails.send({
      from: "Zyvo <niko@tryzyvo.com>",
      to: user.email,
      subject: "what the people actually posting are doing",
      html: engagementEmailHtml(user),
    });

    if (!error) return true;

    lastError = error;
    console.error(`⚠️  Attempt ${attempt} failed for ${user.email}:`, error.message);
    if (attempt < 2) await sleep(RETRY_DELAY_MS);
  }

  console.error(`❌ Giving up on ${user.email}:`, lastError?.message);
  return false;
}

/* ================= MAIN HANDLER ================= */

export default async function handler(req, res) {
  try {
    console.log("🚀 Starting engagement email campaign...");
    console.log(`   dry_run=${DRY_RUN}  max_send=${MAX_SEND}  cooldown=${MIN_HOURS_SINCE_LAST_EMAIL}h`);

    // --- paginated fetch ---
    let allUsers = [];
    let from = 0;

    while (true) {
      const { data, error } = await supabase
        .from("profiles")
        .select("email, last_email_sent_at, last_email_type")
        .eq("email_updates", true)
        .range(from, from + BATCH_SIZE - 1);

      if (error) {
        console.error("❌ Supabase fetch error:", error);
        return res.status(500).json({ error: "Failed to fetch users" });
      }

      if (!data || data.length === 0) break;

      allUsers.push(...data);
      if (data.length < BATCH_SIZE) break;
      from += BATCH_SIZE;
    }

    console.log(`📊 Total opted-in users: ${allUsers.length}`);

    let sent = 0;
    let failed = 0;
    let skipped = 0;

    for (const user of allUsers) {
      if (sent >= MAX_SEND) {
        console.log(`🛑 Reached MAX_SEND (${MAX_SEND}) — stopping.`);
        break;
      }

      if (!user.email) {
        skipped++;
        continue;
      }

      if (isEmaildTooRecently(user.last_email_sent_at)) {
        skipped++;
        console.log(`⏭️  Skipping (emailed < ${MIN_HOURS_SINCE_LAST_EMAIL}h ago): ${user.email}`);
        continue;
      }

      if (user.last_email_type === "engagement_email") {
        skipped++;
        console.log(`⏭️  Skipping (already got this email): ${user.email}`);
        continue;
      }

      if (DRY_RUN) {
        console.log(`🧪 DRY RUN: would send to ${user.email}`);
        sent++;
        continue;
      }

      console.log(`➡️  Sending to: ${user.email}`);

      const ok = await sendEmail(user);

      if (ok) {
        sent++;

        await supabase
          .from("profiles")
          .update({
            last_email_sent_at: new Date().toISOString(),
            last_email_type: "engagement_email",
          })
          .eq("email", user.email);
      } else {
        failed++;
      }

      await sleep(DELAY_MS);
    }

    console.log("🎯 Campaign complete");
    console.log(`✅ Sent:    ${sent}`);
    console.log(`❌ Failed:  ${failed}`);
    console.log(`⏭️  Skipped: ${skipped}`);

    return res.status(200).json({ success: true, sent, failed, skipped });

  } catch (err) {
    console.error("🔥 Unexpected error:", err);
    return res.status(500).json({ error: "Internal error" });
  }
}

/* ================= LOCAL RUN ================= */

if (process.argv[1]?.includes("send-engagement-email.js")) {
  console.log("🟢 Running engagement email locally...");

  handler(
    {},
    {
      status: (code) => ({
        json: (data) => console.log("📤 Response:", code, data),
      }),
    }
  );
}
